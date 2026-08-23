import { createClient } from "@clickhouse/client";
import type { Logger } from "../pino";
import { getClickhouseHostMachineCreds } from "../refrection";
import { assertInitialized, assertNotNil } from "../query/utils/assert";
import { JSON5 } from "bun";

export interface ClickhouseServersConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ICh {
  query(query: string): Promise<Array<{ server: string; result: any }>>;
}

async function getClickhouseConfig(): Promise<ClickhouseServersConfig> {
  const config = await getClickhouseHostMachineCreds();
  return {
    host: String(config.host),
    port: config.port,
    username: config.user || "default",
    password: config.password || "",
  };
}

async function getClickhouseDockerConfig(): Promise<ClickhouseServersConfig> {
  return {
    host: "clickhouse",
    port: 8123,
    username: process.env.CLICKHOUSE_USERNAME || "default",
    password: process.env.CLICKHOUSE_PASSWORD || "",
  };
}

export class Ch implements ICh {
  // maybe in future i am create suppotr multiple client. not now
  public readonly clients;
  private isInitialized = false;

  constructor(private logger: Logger) {
    this.clients = new Map<string, ReturnType<typeof createClient>>();
    if (process.env.HYPERVISOR != "docker") {
      this.logger.warn("Don't forget to call firstFlight() method");
    }
  }

  async firstFlight() {
    const servers =
      process.env.HYPERVISOR === "docker"
        ? [await getClickhouseDockerConfig()]
        : [await getClickhouseConfig()];
    for (const server of servers) {
      const { host, port, username, password } = server;
      this.logger.debug(`Creating ClickHouse client for ${host}:${port}`);

      const client = createClient({
        url: `http://${host}:${port}`,
        username,
        password,
      });

      this.clients.set(`${host}:${port}`, client);
      const pingResult = await client.ping();
      this.logger.info(
        { server: `${host}:${port}`, pingResult },
        `Connected to ClickHouse server`,
      );
    }
    this.isInitialized = true;
  }

  async query(query: string, params: {
    isEmptyArePositive: boolean;
  } = { isEmptyArePositive: true }): Promise<Array<{ server: string; result: any }>> {
    assertInitialized(  
      this.isInitialized,
      "ClickHouse client is not initialized",
    );

    console.log(query);

    const results: Array<{ server: string; result: any }> = [];
    for (const [server, client] of this.clients) {
      try {
        const result = await client.query({ query });
        const resultRaw = await result.text();
        if (params.isEmptyArePositive && resultRaw.trim().length === 0) {
          results.push({ server, result: [] });
          continue;
        }
        const parsedResult = JSON5.parse(resultRaw);
        results.push({ server, result: parsedResult });
      } catch (error) {
        const erroredQuery =
          process.env.NODE_ENV === "production"
            ? query.trim().replace(/\s+/g, " ").substring(0, 300)
            : query.replace(/\s+/g, " ");
        this.logger.error(
          {
            server,
            query: erroredQuery,
            error: error instanceof Error ? error.message : String(error),
          },
          `Failed to execute query on ClickHouse server`,
        );
        results.push({ server, result: null });
      }
    }
    return results;
  }
}
