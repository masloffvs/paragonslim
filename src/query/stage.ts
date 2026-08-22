import { Source } from "./sources/source";
import { Context } from "./sources/context";
import { Transformer } from "./transformers/transformer";

export class Stage {
  constructor(
    private readonly source: Source,
    private readonly transformer: Transformer,
  ) {}

  public bindContext(context: Context) {
    const ctx = context;
    this.source.bindContext(ctx);
  }

  public getSource(): Source {
    return this.source;
  }

  public getTransformer(): Transformer {
    return this.transformer;
  }

  public async execute<T, R extends any[]>(
    prevResults: R,
  ): Promise<T | null | undefined> {
    try {
      const results: Awaited<T> | null | undefined = await this.source.execute<
        T,
        R
      >(prevResults);
      if (results === null || results === undefined) {
        return results;
      }
      if (!Array.isArray(results)) {
        return this.transformer.transform(results);
      }
      return results.map((row) => this.transformer.transform(row)) as T;
    } catch (error) {
      console.error("Error in stage execution:", error);
      throw error;
    }
  }
}
