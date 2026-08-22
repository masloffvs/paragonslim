import { readdir } from "fs/promises";
import { join } from "path";
import { injectable } from "tsyringe";
import { Dataset } from "./dataset";
import { Logger } from "../pino";

@injectable()
export class Datasets {
  private datasetFileExt = ['.js', '.ts']
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
      
      for (const file of files) {
        if (this.datasetFileExt.some(ext => file.endsWith(ext))) {
          const filePath = join(datasetsPath, file);
          try {
            const module = await import(filePath);
            const dataset = module.default;
            
            if (dataset instanceof Dataset) {
              this.register(dataset.define?.name || file.replace(new RegExp(`\\.(${this.datasetFileExt.join('|')})$`), ''), dataset);
            } else {
              this.logger.warn(`File ${file} does not export a Dataset instance`);
            }
          } catch (error) {
            this.logger.error(`Failed to load dataset from ${file}: ${error}`);
          }
        }
      }
    } catch (error) {
      this.logger.error(`Failed to read datasets directory: ${error}`);
    }
  }
}
