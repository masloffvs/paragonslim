import $logger from "../../pino";
import { Source } from "./source";
import { createReadStream } from "fs";
export { PassThroughTransformer, PassThroughTransformerSource } from "./passThroughTransformer";

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

export class StreamCSVSource extends Source {
  private filePath: string;
  private delimiter: string;
  private headers: string[] | null = null;

  constructor(filePath: string, delimiter: string = ",") {
    super("");
    this.filePath = filePath;
    this.delimiter = delimiter;
  }

  private static readonly EXECUTE_ROW_WARNING_THRESHOLD = 200_000;

  public override async execute<T, R extends any[]>(
    prevResults: R,
  ): Promise<T | null | undefined> {
    const rows: any[] = [];
    let count = 0;

    for await (const row of this.streamRows()) {
      rows.push(row);
      count++;

      if (count === StreamCSVSource.EXECUTE_ROW_WARNING_THRESHOLD) {
        $logger.warn(
          `${this.filePath}: limit ${count} rows in execute() ` +
            `Use process() or streamBatches() instead of accumulating in memory.`,
        );
      }
    }

    return rows as T | null | undefined;
  }

  public async process(
    handler: (row: any, index: number) => void | Promise<void>,
  ): Promise<number> {
    let index = 0;
    for await (const row of this.streamRows()) {
      await handler(row, index);
      index++;
    }
    return index;
  }

  public async *streamBatches(batchSize: number = 1000): AsyncGenerator<any[]> {
    let batch: any[] = [];

    for await (const row of this.streamRows()) {
      batch.push(row);
      if (batch.length >= batchSize) {
        yield batch;
        batch = [];
      }
    }

    if (batch.length > 0) {
      yield batch;
    }
  }

  public async *streamRows(): AsyncGenerator<any> {
    const stream = createReadStream(this.filePath, {
      encoding: "utf8",
      highWaterMark: 1024 * 1024,
    });

    let buffer = "";
    let lineCount = 0;

    for await (const chunk of stream) {
      buffer += chunk;
      buffer = yield* this.consumeLines(
        buffer,
        () => lineCount++,
        (n) => (lineCount = n),
        lineCount,
      );
    }

    if (buffer.trim() !== "") {
      const values = this.parseCSVLine(buffer);
      if (this.headers && values.length === this.headers.length) {
        yield this.createRowFromValues(values);
      }
    }
  }

  private *consumeLines(
    buffer: string,
    _inc: () => void,
    _setLineCount: (n: number) => void,
    startLineCount: number,
  ): Generator<any, string, void> {
    let lineCount = startLineCount;
    let start = 0;
    let nlIndex: number;

    while ((nlIndex = buffer.indexOf("\n", start)) !== -1) {
      const line = buffer.slice(start, nlIndex);
      start = nlIndex + 1;

      if (line.length === 0 || line.trim() === "") continue;

      if (lineCount === 0) {
        this.headers = this.parseCSVLine(line);
        lineCount++;
        continue;
      }

      const values = this.parseCSVLine(line);
      if (this.headers && values.length === this.headers.length) {
        yield this.createRowFromValues(values);
      }
      lineCount++;
    }

    return buffer.slice(start);
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === this.delimiter && !inQuotes) {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  private createRowFromValues(values: string[]): any {
    const row: any = {};
    if (!this.headers) return row;

    const headers = this.headers;

    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      if (header === undefined) continue;

      const value = values[i];
      row[header] = this.parseValue(value ?? "");
    }

    return row;
  }

  private parseValue(raw: string): any {
    if (raw === "" || raw === null || raw === undefined) {
      return null;
    }

    const value = raw.trim();
    if (value === "") return null;

    if (NUMERIC_RE.test(value)) {
      return Number(value);
    }

    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;

    return value;
  }
}
