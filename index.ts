import "reflect-metadata";
import { initializeCli, initializeDI } from "./src/di";
import { Server } from "./src/server";
import { getServersConfigFromFile, getVolumesConfigFromFile } from "./src/servers/config";
import { Datasets } from "./src/servers/datasets";
import { MigrationService } from "./src/servers/migration";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Context } from "./src/query/sources/context";
import { createDataServer } from "./src/query/dataserver";
import { Stage } from "./src/query/stage";
import { ClickHouseSource } from "./src/query/sources/clickHouse";
import { Transformation } from "./src/query/transformation";
import { ArrayOfRowsSource } from "./src/query/sources/arrayOfRows";
import { StreamCSVSource } from "./src/query/sources/streamCSV";
import { BasicDeenthropyTransformer } from "./src/query/transformers/basicDeenthropyTransformer";
import { DataServer } from "./src/query/dataserver";
import { Dataset } from "./src/servers/dataset";
import { readdir } from "fs/promises";
import { exit } from "process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cli = initializeCli();

const port = cli.getOptionValue<number>("port");
const host = cli.getOptionValue<string>("host");
const serversConfig = cli.getOptionValue<string>("serversConfig");

const config = getServersConfigFromFile(serversConfig);
const { container: containerInstance, ch } = initializeDI(
  config.getServersSet(),
);

const volumesConfig = getVolumesConfigFromFile(cli.getOptionValue<string>("volumesConfig"));
const mainContext = new Context(ch, volumesConfig.config);

const dataServer: DataServer = createDataServer(mainContext);

const server = containerInstance.resolve(Server);
const datasets = containerInstance.resolve(Datasets);
const migrationService = containerInstance.resolve(MigrationService);

const datasetsPath = join(__dirname, "datasets");
await datasets.loadFromDirectory(datasetsPath);

// Регистрируем схемы датасетов в контексте для автоматического определения primaryKey
for (const [name, dataset] of datasets.getAll()) {
  const primaryKey = dataset.define.clickhouse?.primaryKey;
  if (primaryKey) {
    mainContext.datasetSchemas.set(name, { primaryKey });
  }
}

if (cli.isImportFromFile()) {
  const entrypoint = cli.getOptionValue<string>("entrypoint");
  const forceRecreateTable = cli.getOptionValue<boolean>("forceRecreateTable");

  if (!entrypoint) {
    console.error("Error: --entrypoint (-e) is required for import:fromFile");
    exit(1);
  }

  console.log(`Searching for importer entrypoint: ${entrypoint}`);
  const files = await readdir(datasetsPath);
  let targetDataset: Dataset | undefined = undefined;
  let importerFn: ((dataserver: DataServer) => Promise<void>) | undefined = undefined;

  for (const file of files) {
    if (file.endsWith(".ts") || file.endsWith(".js")) {
      const filePath = join(datasetsPath, file);
      const baseName = file.replace(/\.(ts|js)$/, "");
      try {
        const module = await import(filePath);
        const dataset = module.default;
        const importer = module.importerFromFile;

        if (
          baseName.toLowerCase() === entrypoint.toLowerCase() ||
          (dataset && dataset.define?.name?.toLowerCase() === entrypoint.toLowerCase())
        ) {
          targetDataset = dataset;
          importerFn = importer;
          break;
        }
      } catch (err) {
        // ignore load errors for other files
      }
    }
  }

  if (!targetDataset) {
    console.error(`Error: Dataset not found for entrypoint: ${entrypoint}`);
    exit(1);
  }

  if (!importerFn || typeof importerFn !== "function") {
    console.error(`Error: 'importerFromFile' function not exported by dataset entrypoint: ${entrypoint}`);
    exit(1);
  }

  const chConfig = targetDataset.define.clickhouse || {};
  const database = chConfig.database || "default";
  const tableName = targetDataset.define.name;
  const fullTableName = `${database}.${tableName}`;

  if (forceRecreateTable) {
    console.log(`Force recreating table ${fullTableName}...`);
    try {
      await ch.query(`DROP TABLE IF EXISTS ${fullTableName}`);
      console.log(`Table ${fullTableName} dropped successfully.`);
    } catch (err) {
      console.error(`Failed to drop table ${fullTableName}:`, err);
      exit(1);
    }
  }

  await migrationService.migrate();

  console.log(`Running importer for ${entrypoint}...`);
  dataServer.setConfirmation(async () => true);
  await importerFn(dataServer);
  console.log(`Import completed successfully.`);
  exit(0);
} else {
  await migrationService.migrate();
  await server.listen(port);
}


