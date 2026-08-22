import { Elysia } from "elysia";
import { staticPlugin } from "@elysiajs/static";
import { injectable, singleton, inject } from "tsyringe";
import { Logger } from "./pino";
import { Datasets } from "./servers/datasets";
import { type ICh } from "./ch/init";

@injectable()
@singleton()
export class Server {
  private server: Elysia;

  constructor(
    private logger: Logger,
    private datasets: Datasets,
    @inject("Ch") private ch: ICh
  ) {
    this.server = new Elysia()
      .use(staticPlugin({
        assets: "dist",
        prefix: "/",
      }))
      .get("/api/datasets", () => {
        const datasets = Array.from(this.datasets.getAll().values()).map(d => d.define);
        return datasets;
      })
      .get("/api/clients", () => {
        // @ts-ignore - accessing private clients map from Ch
        const clients = Array.from(this.ch.clients.keys());
        return clients.map(key => ({
            id: key,
            host: key.split(':')[0],
            port: key.split(':')[1]
        }));
      });
    this.logger.info("Server initialized");
  }

  async listen(port: number) {
    await this.server.listen(port);
    this.logger.info(`Server listening on port ${port}`);
  }
}
