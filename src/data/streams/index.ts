export interface IStream<T> {
  readEveryRow(it: (row: T) => Promise<void> | void): Promise<void>;
  redirectToBatch(it: (items: T[]) => Promise<void> | void, batchSize?: number): Promise<void>;
}

export class Stream<T> implements IStream<T> {
  private source: string;
  private filterFn?: (row: T) => boolean;
  constructor(props: { source: string }) {
    this.source = props.source;
    this.filterFn = undefined;
  }
  protected getSource(): string {
    return this.source;
  }
  filter(it: (row: T) => boolean): Stream<T> {
    this.filterFn = it;
    return this;
  }

  protected isFiltered(row: T): boolean {
    if (this.filterFn == undefined) {
      return true;
    }
    return this.filterFn(row);
  }

  async redirectToBatch(it: (items: T[]) => Promise<void> | void, batchSize: number = 1000): Promise<void> {
    let count = 0;
    const items: T[] = [];
    for await (const row of this.parseRows()) {
       items.push(row);
       count++;
       if (count >= batchSize) {
         count = 0;
         await it(items);
         items.length = 0;
       }
    }
    if (items.length > 0) {
      await it(items);
    }
  }
  
  protected async *parseRows(): AsyncGenerator<T, void, unknown> {
    const rows: T[] = [];
    await this.readEveryRow((row) => {
        if (this.isFiltered(row)) {
            rows.push(row);
        }
    });
    for (const row of rows) {
      yield row;
    }
  }

  async readEveryRow(it: (row: T) => Promise<void> | void): Promise<void> {
    throw new Error('readEveryRow must be implemented by subclass');
  }
}
