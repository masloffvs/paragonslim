import { ClickHouseClient } from "@clickhouse/client";
import { inject, injectable } from "tsyringe";
import { singleton } from "tsyringe";
import { Logger } from "../pino";
import type { Dataset } from "../servers/dataset";

interface WriteParams {
  /**
   * write data in every client
   */
  multicast: boolean;
  /**
   * suppress output
   */
  silent: boolean;
}

@injectable()
@singleton()
export class DataServer {
  constructor(
    @inject(Logger) private logger: Logger,
    private clickhouseClients: Array<ClickHouseClient>
  ) {
    for (const client of this.clickhouseClients) {
      // object.. okay..
      this.logger.info({ client: client.toString() }, `ClickHouse client initialized`);
    }
  }

  async write<T>(dataset: Dataset, data: T[], params: WriteParams = { multicast: true, silent: false }) {
    for (const client of this.clickhouseClients) {
      if (params.multicast) {
        const filteredData = dataset.peekOnlyDatasetKeysInObjArray(data);
      
        const query = await client.insert({
          table: dataset.fullTableName,
          values: filteredData,
          format: "JSONEachRow",
        });

        if (!params.silent) {
          process.stdout.write(".");
        }
        // console.log(query);
      } 
    }
  }

  async optimize(dataset: Dataset, params: WriteParams = { multicast: true, silent: false }) {
    for (const client of this.clickhouseClients) {
      if (params.multicast) {
        await client.command({
          query: `OPTIMIZE TABLE ${dataset.fullTableName} FINAL`,
        });

        if (!params.silent) {
          console.log("🗲");
        } 
      }
    }
  }
}
