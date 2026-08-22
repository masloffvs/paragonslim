import "reflect-metadata";
import { container } from "tsyringe";
import { Logger } from "./pino";
import { Server } from "./server";
import { Cli } from "./cli";
import { Ch, type ClickhouseServersConfig, type ICh } from "./ch/init";
import { Datasets } from "./servers/datasets";
import { MigrationService } from "./servers/migration";

export function initializeCli() {
  container.register("Logger", { useClass: Logger });
  container.registerSingleton("Logger", Logger);
  container.register("Cli", { useClass: Cli });
  container.registerSingleton("Cli", Cli);
  return container.resolve(Cli);
}

export function initializeDI(serversConfig: Set<ClickhouseServersConfig>) {
  container.registerSingleton("Logger", Logger);
  container.registerSingleton("Cli", Cli);
  container.registerSingleton("Server", Server);
  container.registerSingleton(Datasets, Datasets);
  container.registerSingleton(MigrationService, MigrationService);
  
  const ch = new Ch(container.resolve("Logger"), serversConfig);
  container.register<ICh>("Ch", { useValue: ch });

  return { container, ch };
}

export function getContainer() {
  return container;
}
