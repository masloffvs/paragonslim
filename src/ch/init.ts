import { createClient } from "@clickhouse/client";
import type { Logger } from "../pino";

export interface ClickhouseServersConfig {
  host: string;
  port: number;
  username: string;
  password: string;
}

export interface ICh {
  query(query: string): Promise<Array<{ server: string; result: any }>>;
}

export class Ch implements ICh {
  public readonly clients;

  constructor(private logger: Logger, servers: Set<ClickhouseServersConfig>) {
    this.clients = new Map<string, ReturnType<typeof createClient>>();
    for (const server of servers) {
      const { host, port, username, password } = server;
      this.logger.debug(`Creating ClickHouse client for ${host}:${port}`);

      const client = createClient({
        url: `http://${host}:${port}`,
        username,
        password,
      });

      this.clients.set(`${host}:${port}`, client);
      client
        .ping()
        .then(() => {
          this.logger.info(`Connected to ClickHouse server at ${host}:${port}`);
        })
        .catch((error) => {
          this.logger.error(
            `Failed to connect to ClickHouse server at ${host}:${port}: ${error.message}`,
          );
        });
    }
  }

  public async query(
    query: string,
  ): Promise<Array<{ server: string; result: any }>> {
    const results = [];
    for (const [key, client] of this.clients.entries()) {
      try {
        const result = await client.query({ query });
        results.push({ server: key, result });
      } catch (error) {
        this.logger.warn(
          `Query failed on ClickHouse server at ${key}: ${error?.message}`,
        );
      }
    }
    return results;
  }
}
