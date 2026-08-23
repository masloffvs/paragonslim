import { readdir } from "fs/promises";
import { join, extname, basename } from "path";
import { injectable } from "tsyringe";
import { Dataset } from "./dataset";
import { Logger } from "../pino";

@injectable()
export class Datasets {
  private datasetFileExt = new Set([".js", ".ts"]);
  private datasets: Map<string, Dataset> = new Map();

  constructor(private logger: Logger) {}

  register(name: string, dataset: Dataset): void {
    this.datasets.set(name, dataset);
    this.logger.info(`Registered dataset: ${name}`);
  }

  get(name: string): Dataset | undefined {
    return this.datasets.get(name);
  }

  getAll(): Map<string, Dataset> {
    return this.datasets;
  }

  has(name: string): boolean {
    return this.datasets.has(name);
  }

  async loadFromDirectory(datasetsPath: string): Promise<void> {
    try {
      const files = await readdir(datasetsPath);
      await Promise.all(
        files.map((file) => this.loadDatasetFile(datasetsPath, file)),
      );
    } catch (error) {
      this.logger.error(`Failed to read datasets directory: ${error}`);
    }
  }

  private async loadDatasetFile(
    datasetsPath: string,
    file: string,
  ): Promise<void> {
    const ext = extname(file);
    if (!this.datasetFileExt.has(ext)) return;

    const filePath = join(datasetsPath, file);

    try {
      const module = await import(filePath);
      const dataset = module.default;

      if (!(dataset instanceof Dataset)) {
        this.logger.warn(`File ${file} does not export a Dataset instance`);
        return;
      }

      const datasetName = dataset.define?.name || basename(file, ext);
      this.register(datasetName, dataset);
    } catch (error) {
      this.logger.error(`Failed to load dataset from ${file}: ${error}`);
    }
  }
}
