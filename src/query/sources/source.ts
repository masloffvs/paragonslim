import { Context } from "./context";

export class Source {
  protected context: Context | null = null;

  constructor(protected readonly raw: string) {}

  public bindContext(ctx: Context): this {
    this.context = ctx;
    return this;
  }

  public execute<T, R extends any[]>(prevResults: R): Promise<T | null | undefined> {
    void prevResults;
    
    return this.context?.ch.query(this.raw) as Promise<T | null | undefined>;
  }
}
