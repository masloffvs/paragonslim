import { injectable, singleton, inject } from "tsyringe";
import { Logger } from "../pino";
import { type ICh } from "../ch/init";
import { Datasets } from "./datasets";
import { Dataset } from "./dataset";

const len = (obj: any) => Object.keys(obj).length;

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
    const config = dataset.define.clickhouse || {};
    const database = config.database || "default";
    const tableName = dataset.define.name;
    
    this.logger.debug(`Migrating dataset ${dataset.define.name} to ${database}.${tableName} with engine ${config.engine || 'MergeTree'}`);

    await this.createDatabase(database);
    await this.createOrUpdateTable(database, tableName, dataset, config);
  }

  private async createDatabase(database: string): Promise<void> {
    this.logger.debug(`Executing: CREATE DATABASE IF NOT EXISTS ${database}`);
    const query = `CREATE DATABASE IF NOT EXISTS ${database}`;
    try {
      await this.ch.query(query);
      this.logger.debug(`Database ${database} ensured`);
    } catch (error: any) {
      // Ignore database already exists errors
      if (error.code === "57" || error.type === "TABLE_ALREADY_EXISTS" || error.message?.includes("already exists")) {
        this.logger.debug(`Database ${database} already exists, skipping creation`);
      } else {
        this.logger.error(`Failed to create database ${database}: ${error}`);
        throw error;
      }
    }
  }

  private async createOrUpdateTable(
    database: string,
    tableName: string,
    dataset: Dataset,
    config: any,
  ): Promise<void> {
    const fullTableName = `${database}.${tableName}`;
    
    this.logger.debug(`Checking if table ${fullTableName} exists`);
    const checkQuery = `EXISTS TABLE ${fullTableName}`;
    const existsResult = await this.ch.query(checkQuery);
    
    const tableExists = existsResult.some(
      (r) => r.result === true || r.result?.data?.[0]?.exists === true
    );
    
    this.logger.debug(`Table ${fullTableName} exists: ${tableExists}`);
    
    if (!tableExists) {
      this.logger.debug(`Table ${fullTableName} does not exist, creating new table`);
      await this.createTable(database, tableName, dataset, config);
    } else {
      this.logger.debug(`Table ${fullTableName} exists, checking for column updates`);
      await this.updateTable(database, tableName, dataset);
    }
  }

  private async createTable(
    database: string,
    tableName: string,
    dataset: Dataset,
    config: any,
  ): Promise<void> {
    const fullTableName = `${database}.${tableName}`;
    this.logger.debug(`Generating column definitions for ${tableName}`);
    const columns = this.generateColumns(dataset);
    const engine = config.engine || "MergeTree";
    const engineClause = this.generateEngineClause(engine, config);
    const orderBy = config.orderBy?.join(", ") || "id";
    const partitionBy = config.partitionBy ? `PARTITION BY ${config.partitionBy}` : "";
    const primaryKey = config.primaryKey?.join(", ") ? `PRIMARY KEY (${config.primaryKey.join(", ")})` : "";
    const uniqConstraints = (config.uniqKeys || [])
      .map((key: string) => `    UNIQUE (${key})`)
      .join(",\n");
    
    this.logger.debug(`Table configuration: engine=${engine}, orderBy=(${orderBy}), partitionBy=${partitionBy || 'none'}, primaryKey=${primaryKey || 'none'}, uniqKeys=${uniqConstraints || 'none'}`);
    
    // Проверяем, есть ли primaryKey в настройках - если да, используем String для shard key, иначе UUID
    const hasPrimaryKey = config.primaryKey && config.primaryKey.length > 0;
    const idType = hasPrimaryKey ? "String" : "UUID";
    const idDefault = hasPrimaryKey ? "" : "DEFAULT generateUUIDv4()";
    
    const query = `
      CREATE TABLE IF NOT EXISTS ${database}.${tableName} (
        id ${idType} ${idDefault},
        ${columns}
      )
      ENGINE = ${engineClause}
      ORDER BY (${orderBy})
      ${partitionBy}
      ${primaryKey}
      ${config.settings ? `SETTINGS ${Object.entries(config.settings).map(([k, v]) => `${k} = ${v}`).join(", ")}` : ""}
    `;
    
    this.logger.debug(`Executing CREATE TABLE for ${database}.${tableName}`);
    try {
      await this.ch.query(query);
      this.logger.debug(`Successfully created table ${database}.${tableName}`);
      
      for (const key of config.uniqKeys || []) {
        try {
          await this.ch.query(`ALTER TABLE ${fullTableName} ADD CONSTRAINT uniq_${key} UNIQUE (${key})`);
          this.logger.debug(`Added unique constraint uniq_${key} to ${fullTableName}`);
        } catch (error: any) {
          this.logger.warn(`Failed to add unique constraint for ${key}: ${error}`);
        }
      }
    } catch (error: any) {
      if (error.code === "57" || error.type === "TABLE_ALREADY_EXISTS") {
        this.logger.debug(`Table ${database}.${tableName} already exists, skipping creation`);
      } else {
        this.logger.error(`Failed to create table ${database}.${tableName}: ${error}`);
        throw error;
      }
    }
  }

  private generateEngineClause(engine: string, config: any): string {
    // Engines that don't require parentheses
    const noParenthesesEngines = ["Memory", "File", "Null", "Set", "Join", "URL", "View", "Dictionary", "Merge", "Executable", "Buffer", "GenerateRandom", "KeeperMap", "FileLog", "Alias"];
    
    if (noParenthesesEngines.includes(engine)) {
      return engine;
    }
    
    // MergeTree and Log engines require parentheses
    return `${engine}()`;
  }

  private async updateTable(
    database: string,
    tableName: string,
    dataset: Dataset,
  ): Promise<void> {
    const fullTableName = `${database}.${tableName}`;
    
    this.logger.debug(`Fetching existing columns from ${fullTableName}`);
    const columnsQuery = `DESCRIBE TABLE ${fullTableName}`;
    const columnsResult = await this.ch.query(columnsQuery);
    
    const existingColumns = new Set<string>();
    for (const result of columnsResult) {
      if (result.result?.data) {
        for (const row of result.result.data) {
          existingColumns.add(row.name);
        }
      }
    }
    
    this.logger.debug(`Found ${existingColumns.size} existing columns: ${Array.from(existingColumns).join(', ')}`);
    
    const row = dataset.define.row || {};
    const requiredColumns = Object.keys(row);
    this.logger.debug(`Required columns from dataset: ${requiredColumns.join(', ')}`);
    
    let columnsAdded = 0;
    for (const [key, columnDef] of Object.entries(row)) {
      if (!existingColumns.has(key)) {
        this.logger.debug(`Column ${key} is missing, will add it`);
        const columnType = this.mapTypeToClickHouse(columnDef.type, columnDef.nullable);
        const alterQuery = `ALTER TABLE ${fullTableName} ADD COLUMN IF NOT EXISTS ${key} ${columnType}`;
        this.logger.debug(`Executing: ${alterQuery}`);
        try {
          await this.ch.query(alterQuery);
          this.logger.debug(`Added column ${key} to ${fullTableName}`);
          columnsAdded++;
        } catch (error: any) {
          if (error.code === "57" || error.type === "TABLE_ALREADY_EXISTS" || error.message?.includes("already exists")) {
            this.logger.debug(`Column ${key} already exists in ${fullTableName}, skipping`);
          } else {
            this.logger.error(`Failed to add column ${key} to ${fullTableName}: ${error}`);
            throw error;
          }
        }
      } else {
        this.logger.debug(`Column ${key} already exists in ${fullTableName}`);
      }
    }

    const uniqKeys = dataset.define.clickhouse?.uniqKeys || [];
    for (const key of uniqKeys) {
      if (existingColumns.has(key)) {
        this.logger.debug(`Adding unique constraint for column ${key}`);
        try {
          await this.ch.query(`ALTER TABLE ${fullTableName} ADD CONSTRAINT IF NOT EXISTS uniq_${key} UNIQUE (${key})`);
          this.logger.debug(`Added unique constraint uniq_${key} to ${fullTableName}`);
        } catch (error: any) {
          this.logger.warn(`Failed to add unique constraint for ${key}: ${error}`);
        }
      }
    }
    
    this.logger.debug(`Table update completed. Added ${columnsAdded} new columns to ${fullTableName}`);
  }

  private generateColumns(dataset: Dataset): string {
    const row = dataset.define.row || {};
    const columns: string[] = [];
    
    for (const [key, columnDef] of Object.entries(row)) {
      if (key === "id") continue;
      const columnType = this.mapTypeToClickHouse(columnDef.type, columnDef.nullable);
      const nullable = columnDef.nullable ? "" : " NOT NULL";
      const defaultValue = columnDef.defaultValue !== undefined ? ` DEFAULT ${JSON.stringify(columnDef.defaultValue)}` : "";
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
    
    const chType = typeMap[type] || "String";
    return nullable ? `Nullable(${chType})` : chType;
  }
}
