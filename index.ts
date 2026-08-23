import "reflect-metadata";
import { initializeCli, initializeDI } from "./src/di";
import { Server } from "./src/server";
import { Datasets } from "./src/servers/datasets";
import { MigrationService } from "./src/servers/migration";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { Context } from "./src/query/sources/context";
import { DataServer } from "./src/query/dataserver";
import { Dataset } from "./src/servers/dataset";
import { readdir } from "fs/promises";
import { exit } from "process";
import $logger, { Logger } from "./src/pino";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const cli = initializeCli();

const port = cli.getOptionValue<number>("port");
const host = cli.getOptionValue<string>("host");

const { container: containerInstance, ch } = initializeDI();

await ch.firstFlight();

const mainContext = new Context(ch);

const dataServer: DataServer = new DataServer(
  containerInstance.resolve(Logger),
  Array.from(ch.clients.values()),
);

const server = containerInstance.resolve(Server);
const datasets = containerInstance.resolve(Datasets);
const migrationService = containerInstance.resolve(MigrationService);

const datasetsPath = join(__dirname, "datasets");
await datasets.loadFromDirectory(datasetsPath);

for (const [name, dataset] of datasets.getAll()) {
  const primaryKey = dataset.define.clickhouse?.primaryKey;
  if (primaryKey) {
    mainContext.datasetSchemas.set(name, { primaryKey });
  }
}

await migrationService.migrate();

if (cli.isImportFromFile()) {
  const entrypoint = cli.getOptionValue<string>("entrypoint");
  const forceRecreateTable = cli.getOptionValue<boolean>("forceRecreateTable");

  if (!entrypoint) {
    $logger.error("Error: --entrypoint (-e) is required for import:fromFile");
    exit(1);
  }

  const files = await readdir(datasetsPath);
  let targetDataset: Dataset | undefined = undefined;
  let importerFn: ((dataserver: DataServer) => Promise<void>) | undefined =
    undefined;

  for (const file of files) {
    if (!/^\w+\.ts$|^\w+\.js$/.test(file)) {
      continue;
    }

    const filePath = join(datasetsPath, file);
    const baseName = file.replace(/\.(ts|js)$/, "");
    const stream = await Bun.file(filePath).stream();
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = new TextDecoder().decode(value);
      const forbiddenDirectives = [
        "process.exit",
        "process.kill",
        "process.abort",
        "exit(",
        "process.exitCode",
      ];
      for (const directive of forbiddenDirectives) {
        if (text.includes(directive)) {
          throw new Error(
            `Forbidden directive '${directive}' found in dataset file: ${filePath}`,
          );
        }
      }
    }
    const module = await import(filePath);
    const dataset = module.default;
    const importer = module.importerFromFile;

    if (
      baseName.toLowerCase() === entrypoint.toLowerCase() ||
      (dataset &&
        dataset.define?.name?.toLowerCase() === entrypoint.toLowerCase())
    ) {
      targetDataset = dataset;
      importerFn = importer;
      break;
    }
  }

  if (!targetDataset) {
    $logger.error(`Error: Dataset not found for entrypoint: ${entrypoint}`);
    exit(1);
  }

  if (!importerFn || typeof importerFn !== "function") {
    $logger.error(
      `Error: 'importerFromFile' function not exported by dataset entrypoint: ${entrypoint}`,
    );
    exit(1);
  }

  const chConfig = targetDataset.define.clickhouse || {};
  const database = chConfig.database || "default";
  const tableName = targetDataset.define.name;
  const fullTableName = `${database}.${tableName}`;

  if (forceRecreateTable) {
    $logger.info(`Force recreating table ${fullTableName}...`);
    try {
      await ch.query(`DROP TABLE IF EXISTS ${fullTableName}`);
      $logger.info(`Table ${fullTableName} dropped successfully.`);
    } catch (err) {
      $logger.error(`Failed to drop table ${fullTableName}:`, err);
      exit(1);
    }
  }

  $logger.info(`Running importer for ${entrypoint}...`);
  await importerFn(dataServer);
  $logger.info(`Import completed successfully.`);
  // OPTIMIZE TABLE default.yandex_praktikum_001 FINAL;
  exit(0);
} else {
  await server.listen(port);
}
