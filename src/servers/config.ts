import { existsSync, readFileSync } from "node:fs";
import toml from "toml";
import $logger from "../pino";
import type { ClickhouseServersConfig } from "../ch/init";

export interface ServersConfig {
  [key: string]: ClickhouseServersConfig;
}

class ServersConfigFromFile {
  private static instance: ServersConfigFromFile | null = null;
  public readonly config: ServersConfig;

  constructor(public readonly filePath: string) {
    if (ServersConfigFromFile.instance) {
      throw new Error(
        "ServersConfigFromFile is a singleton class. Use getServersConfigFromFile() to get the instance.",
      );
    }

    $logger.info(`Loading servers config from file: ${filePath}`);
    if (!existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
    this.config = toml.parse(readFileSync(filePath, "utf-8"));
  }

  public createOrGetInstance(): ServersConfigFromFile {
    if (!ServersConfigFromFile.instance) {
      ServersConfigFromFile.instance = new ServersConfigFromFile(this.filePath);
    }
    return ServersConfigFromFile.instance;
  }

  public getServersSet(): Set<ClickhouseServersConfig> {
    const serversSet = new Set<ClickhouseServersConfig>();
    for (const key in this.config) {
      if (Object.prototype.hasOwnProperty.call(this.config, key)) {
        const serverConfig = this.config[key];
        if (!serverConfig) continue;

        if (!serverConfig.host || !serverConfig.port) {
          throw new Error(
            `Invalid server configuration for key "${key}". "host" and "port" are required.`,
          );
        }
        serversSet.add(serverConfig);
      }
    }
    return serversSet;
  }
}

export function getServersConfigFromFile(
  filePath: string,
): ServersConfigFromFile {
  return new ServersConfigFromFile(filePath).createOrGetInstance();
}

export interface VolumesConfig {
  disks: {
    [key: string]: string;
  };
}

class VolumesConfigFromFile {
  private static instance: VolumesConfigFromFile | null = null;
  public readonly config: VolumesConfig;

  constructor(public readonly filePath: string) {
    if (VolumesConfigFromFile.instance) {
      throw new Error(
        "VolumesConfigFromFile is a singleton class. Use getVolumesConfigFromFile() to get the instance.",
      );
    }

    $logger.info(`Loading volumes config from file: ${filePath}`);
    if (!existsSync(filePath)) {
      throw new Error(`Configuration file not found: ${filePath}`);
    }
    this.config = toml.parse(readFileSync(filePath, "utf-8"));
  }

  public createOrGetInstance(): VolumesConfigFromFile {
    if (!VolumesConfigFromFile.instance) {
      VolumesConfigFromFile.instance = new VolumesConfigFromFile(this.filePath);
    }
    return VolumesConfigFromFile.instance;
  }
}

export function getVolumesConfigFromFile(
  filePath: string,
): VolumesConfigFromFile {
  return new VolumesConfigFromFile(filePath).createOrGetInstance();
}
