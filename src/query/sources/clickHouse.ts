import { Source } from "./source";

export class ClickHouseSource extends Source {
  constructor(raw: string) {
    super(raw);
  }

  public override async execute<T, R extends any[]>(
    prevResults: R,
  ): Promise<T | null | undefined> {
    if (!this.context) {
      throw new Error("Context not bound to ClickHouseSource");
    }

    try {
      const result = await this.context.ch.query(
        this.raw + " SETTINGS storage_policy = 'hot'",
      );
      return result as T | null | undefined;
    } catch (error) {
      console.error("ClickHouse query error:", error);
      throw error;
    }
  }
}
