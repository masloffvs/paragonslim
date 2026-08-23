import { injectable, singleton, inject } from "tsyringe";
import { Logger } from "../pino";
import { type ICh } from "../ch/init";
import { Datasets } from "./datasets";
import { Dataset, type DefineDataset, type ClickHouseConfig, type TableEngine } from "./dataset";

interface ClickHouseQueryResult {
  server: string;
  result: {
    data?: any[];
    result?: any;
  } | null;
}

interface ColumnDefinition {
  name: string;
  type: string;
  default_type?: string;
  default_expression?: string;
}

interface EngineConfig {
  name: TableEngine;
  version?: string;
}

interface TableSettings {
  [key: string]: string | number | boolean;
}

const formatSettingValue = (val: string | number | boolean): string => {
  if (typeof val === "string") {
    const escaped = val.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    return `'${escaped}'`;
  }
  return String(val);
};

@injectable()
export class MigrationService {
  constructor(
    @inject("Logger") private logger: Logger,
    @inject("Ch") private ch: ICh,
    @inject(Datasets) private datasets: Datasets,
  ) {}

  async migrate(): Promise<void> {
    this.logger.debug("Starting migration process");

    const datasetCount = this.datasets.getAll().size;
    this.logger.debug(`Found ${datasetCount} datasets to migrate`);

    for (const [name, dataset] of this.datasets.getAll()) {
      await this.migrateDataset(dataset);
    }

    this.logger.debug("Migration process completed");
  }

  private async migrateDataset(dataset: Dataset): Promise<void> {
    const database: string = dataset.define.clickhouse?.database || "default";
    const engine = dataset.define.clickhouse?.engine || "MergeTree";

    this.logger.debug(
      `Migrating dataset ${dataset.define.name} to ${database}.${dataset.tableName} with engine ${typeof engine === 'string' ? engine : engine.name}`,
    );

    await this.createDatabase(database);
    await this.createOrUpdateTable(database, dataset);
  }

  private async createDatabase(database: string): Promise<void> {
    this.logger.debug(`Executing: CREATE DATABASE IF NOT EXISTS ${database}`);
    const query: string = `CREATE DATABASE IF NOT EXISTS ${database}`;
    try {
      await this.ch.query(query);
      this.logger.debug(`Database ${database} ensured`);
    } catch (error: any) {
      // Ignore database already exists errors
      if (
        error.code === "57" ||
        error.type === "TABLE_ALREADY_EXISTS" ||
        error.message?.includes("already exists")
      ) {
        this.logger.debug(
          `Database ${database} already exists, skipping creation`,
        );
      } else {
        this.logger.error(`Failed to create database ${database}: ${error}`);
        throw error;
      }
    }
  }

  private async createOrUpdateTable(
    database: string,
    dataset: Dataset,
  ): Promise<void> {
    const fullTableName: string = dataset.tableName;

    this.logger.debug(`Checking if table ${fullTableName} exists`);
    const checkQuery: string = `EXISTS TABLE ${fullTableName}`;
    const existsResult: ClickHouseQueryResult[] = await this.ch.query(checkQuery);

    for (const result of existsResult) {
      const unpackedExits: boolean = result.result?.data?.result;

      if (unpackedExits) {
        this.logger.debug(
          `Table ${fullTableName} exists, checking for column updates`,
        );
        await this.updateTable(database, dataset, result.server);
        return;
      }

      await this.createTable(database, dataset);
    }
  }

  private async createTable(
    database: string,
    dataset: Dataset,
  ): Promise<void> {
    const fullTableName: string = dataset.tableName;
    this.logger.debug(
      `Generating column definitions for ${dataset.fullTableName}`,
    );

    const engineClause: string = this.generateEngineClause(dataset.define.clickhouse?.engine);
    const columns: string = this.generateColumns(dataset);
    const orderBy: string = Array.isArray(dataset.define.clickhouse?.orderBy) 
      ? dataset.define.clickhouse.orderBy.join(", ")
      : dataset.define.clickhouse?.orderBy || "id";
    const partitionBy: string = dataset.define.clickhouse?.partitionBy
      ? `PARTITION BY ${dataset.define.clickhouse.partitionBy}`
      : "";
    const primaryKey: string = dataset.define.clickhouse?.primaryKey?.join(", ")
      ? `PRIMARY KEY (${dataset.define.clickhouse.primaryKey.join(", ")})`
      : "";
    const uniqConstraints: string = (dataset.define.clickhouse?.uniqKeys || [])
      .map((key: string) => `    UNIQUE (${key})`)
      .join(",\n");

    this.logger.debug(
      `Table configuration: engine=${engineClause}, orderBy=(${orderBy}), partitionBy=${partitionBy || "none"}, primaryKey=${primaryKey || "none"}, uniqKeys=${uniqConstraints || "none"}`,
    );

    const hasPrimaryKey: boolean = dataset.define.clickhouse?.primaryKey && dataset.define.clickhouse.primaryKey.length > 0;
    const row = dataset.define.row || {};
    const idDefinition = row.id;
    
    let idColumn: string;
    if (idDefinition && idDefinition !== false) {
      const idType: string = this.mapTypeToClickHouse(
        idDefinition.type,
        idDefinition.nullable,
      );
      const nullable: string = idDefinition.nullable ? "" : " NOT NULL";
      const defaultValue: string =
        idDefinition.defaultValue !== undefined
          ? ` DEFAULT ${JSON.stringify(idDefinition.defaultValue)}`
          : "";
      idColumn = `id ${idType}${nullable}${defaultValue}`;
    } else {
      const idType: string = hasPrimaryKey ? "String" : "UUID";
      const idDefault: string = hasPrimaryKey ? "" : "DEFAULT generateUUIDv4()";
      idColumn = `id ${idType} ${idDefault}`;
    }

    const settingsClause: string =
      dataset.define.clickhouse?.settings && Object.keys(dataset.define.clickhouse.settings).length > 0
        ? `SETTINGS ${Object.entries(dataset.define.clickhouse.settings)
            .map(([k, v]) => `${k} = ${formatSettingValue(v)}`)
            .join(", ")}`
        : "";

    const query: string = `
  CREATE TABLE IF NOT EXISTS ${fullTableName} (
    ${idColumn},
    ${columns}
  )
  ENGINE = ${engineClause}
  ORDER BY (${orderBy})
  ${partitionBy}
  ${primaryKey}
  ${settingsClause}
`.trim();

    this.logger.debug(`Executing CREATE TABLE for ${fullTableName}`);
    try {
      await this.ch.query(query);
      this.logger.debug(`Successfully created table ${fullTableName}`);

      for (const key of dataset.define.clickhouse?.uniqKeys || []) {
        try {
          await this.ch.query(
            `ALTER TABLE ${fullTableName} ADD CONSTRAINT uniq_${key} UNIQUE (${key})`,
          );
          this.logger.debug(
            `Added unique constraint uniq_${key} to ${fullTableName}`,
          );
        } catch (error: any) {
          this.logger.warn(
            `Failed to add unique constraint for ${key}: ${error}`,
          );
        }
      }
    } catch (error: any) {
      if (error.code === "57" || error.type === "TABLE_ALREADY_EXISTS") {
        this.logger.debug(
          `Table ${fullTableName} already exists, skipping creation`,
        );
      } else {
        this.logger.error(`Failed to create table ${fullTableName}: ${error}`);
        throw error;
      }
    }
  }

  private generateEngineClause(
    engine: TableEngine | EngineConfig | undefined,
    config: { version?: string } = {},
  ): string {
    if (!engine && !config.version) {
      return "MergeTree";
    }

    let engineName: TableEngine;
    let version: string | undefined;

    if (typeof engine === "object" && engine.name) {
      engineName = engine.name;
      version = engine.version;
    } else if (typeof engine === "string") {
      engineName = engine;
      version = config.version;
    } else {
      return "MergeTree";
    }

    const noParenthesesEngines: readonly TableEngine[] = [
      "Memory",
      "File",
      "Null",
      "Set",
      "Join",
      "URL",
      "View",
      "Dictionary",
      "Merge",
      "Executable",
      "Buffer",
      "GenerateRandom",
      "KeeperMap",
      "FileLog",
      "Alias",
    ] as const;

    if (noParenthesesEngines.includes(engineName)) {
      return engineName;
    }

    if (version) {
      return `${engineName}(${version})`;
    }

    return `${engineName}()`;
  }

  private async updateTable(
    database: string,
    dataset: Dataset,
    server: string,
  ): Promise<void> {
    const fullTableName: string = dataset.tableName;

    // ALTER TABLE default.yandex_praktikum MODIFY SETTING storage_policy = 'hot';
    this.ch.query(
      `ALTER TABLE ${fullTableName} MODIFY SETTING storage_policy = 'hot'`,
    );

    this.logger.debug(`Fetching existing columns from ${fullTableName}`);
    const columnsQuery: string = `DESCRIBE TABLE ${fullTableName}`;
    const columnsResult: ClickHouseQueryResult[] =
      await this.ch.query(columnsQuery);

    const existingColumns: Set<string> = new Set<string>();
    for (const result of columnsResult) {
      if (result.result?.data) {
        for (const row of result.result.data) {
          existingColumns.add(row.name);
        }
      }
    }

    this.logger.debug(
      `Found ${existingColumns.size} existing columns: ${Array.from(existingColumns).join(", ")}`,
    );

    const row = dataset.define.row || {};
    const requiredColumns: string[] = Object.keys(row);
    this.logger.debug(
      `Required columns from dataset: ${requiredColumns.join(", ")}`,
    );

    let columnsAdded: number = 0;
    for (const [key, columnDef] of Object.entries(row)) {
      if (!existingColumns.has(key)) {
        if (columnDef === false) {
          continue;
        }
        this.logger.debug(`Column ${key} is missing, will add it`);
        const columnType: string = this.mapTypeToClickHouse(
          columnDef.type,
          columnDef.nullable,
        );
        const alterQuery: string = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS ${key} ${columnType}`;
        this.logger.debug(`Executing: ${alterQuery}`);
        try {
          await this.ch.query(alterQuery);
          this.logger.debug(`Added column ${key} to ${fullTableName}`);
          columnsAdded++;
        } catch (error: any) {
          if (
            error.code === "57" ||
            error.type === "TABLE_ALREADY_EXISTS" ||
            error.message?.includes("already exists")
          ) {
            this.logger.debug(
              `Column ${key} already exists in ${fullTableName}, skipping`,
            );
          } else {
            this.logger.error(
              `Failed to add column ${key} to ${fullTableName}: ${error}`,
            );
            throw error;
          }
        }
      } else {
        this.logger.debug(`Column ${key} already exists in ${fullTableName}`);
      }
    }

    const uniqKeys: string[] = dataset.define.clickhouse?.uniqKeys || [];
    for (const key of uniqKeys) {
      if (existingColumns.has(key)) {
        this.logger.debug(`Adding unique constraint for column ${key}`);
        try {
          await this.ch.query(
            `ALTER TABLE ${fullTableName} ADD CONSTRAINT IF NOT EXISTS uniq_${key} UNIQUE (${key})`,
          );
          this.logger.debug(
            `Added unique constraint uniq_${key} to ${fullTableName}`,
          );
        } catch (error: any) {
          this.logger.warn(
            `Failed to add unique constraint for ${key}: ${error}`,
          );
        }
      }
    }

    this.logger.debug(
      `Table update completed. Added ${columnsAdded} new columns to ${fullTableName}`,
    );
  }

  private generateColumns(dataset: Dataset): string {
    const row = dataset.define.row || {};
    const columns: string[] = [];

    for (const [key, columnDef] of Object.entries(row)) {
      if (key === "id" || columnDef === false) continue;
      const columnType: string = this.mapTypeToClickHouse(
        columnDef.type,
        columnDef.nullable,
      );
      const nullable: string = columnDef.nullable ? "" : " NOT NULL";
      const defaultValue: string =
        columnDef.defaultValue !== undefined
          ? ` DEFAULT ${JSON.stringify(columnDef.defaultValue)}`
          : "";
      columns.push(`${key} ${columnType}${nullable}${defaultValue}`);
    }

    return columns.join(",\n        ");
  }

  private mapTypeToClickHouse(type: string, nullable?: boolean): string {
    const typeMap: Record<string, string> = {
      String: "String",
      Int64: "Int64",
      Float64: "Float64",
      DateTime: "DateTime",
      Boolean: "UInt8",
      UUID: "UUID",
    };

    const chType: string = typeMap[type] || "String";
    return nullable ? `Nullable(${chType})` : chType;
  }
}
