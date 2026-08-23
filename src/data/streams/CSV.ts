import { Stream } from "./index";

export interface ICSVStreamProps {
  source: string;
  delimiter?: string;
  quote?: string | null; // null/undefined = не обрабатывать кавычки как спецсимвол вообще
  encoding?: BufferEncoding;
}

const CR = 13;
const LF = 10;

interface ParserState {
  field: string;
  row: string[];
  inQuotes: boolean;
  dirty: boolean;
}

export default class StreamedCSV<T extends Array<string>> extends Stream<T> {
  private readonly delimiter: number;
  private readonly quote: number | null; // null → квотинг полностью отключён
  private readonly encoding: BufferEncoding;
  private firstKeysRow: string[] | null = null;
  private currentLine: number = 0;

  constructor(props: ICSVStreamProps) {
    super(props);
    this.delimiter = (props.delimiter ?? ",").charCodeAt(0);
    this.encoding = props.encoding ?? "utf8";

    this.quote = props.quote == null ? null : props.quote.charCodeAt(0);
  }

  public getFirstKeysRow(): string[] | null {
    return this.firstKeysRow;
  }

  /**
   * Input: 
   *  ["name", "age"]
   *  ["John", "25"]
   * 
   * Output:
   *  {name: "John", age: "25"}
   */
  public arrayToJsonWithKeys(row: T): Record<string, string> | null {   
    if (!this.firstKeysRow) {
      throw new Error("First keys row is not set");
    }

    if (Object.values(row).length !== this.firstKeysRow.length) {
      throw new Error("Row length does not match first keys row length");
    }


    if (Object.values(row).join("") == Object.values(this.firstKeysRow).join("")) {
      return null;
    }
 
    return Object.fromEntries(this.firstKeysRow.map((key, index) => [key, row[index] ?? ""]));
  }

  override async readEveryRow(
    it: (row: T) => Promise<void> | void,
  ): Promise<void> {
    for await (const row of this.parseRows()) {
      if (this.isFiltered(row)) {
        await it(row);
      }
    }
  }

  protected override async *parseRows(): AsyncGenerator<T> {
    const file = Bun.file(this.getSource());
    const stream = file.stream();
    const reader = stream.getReader();


    const state: ParserState = {
      field: "",
      row: [],
      inQuotes: false,
      dirty: false,
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        yield* this.parseChunk(value as Uint8Array, state);
      }
    } finally {
      reader.releaseLock();
    }

    if (state.dirty || state.row.length > 0 || state.field.length > 0) {
      state.row.push(state.field);

      yield state.row as T;
    }
  }

  private *parseChunk(chunk: Uint8Array, state: ParserState): Generator<T> {
    const buf = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    const len = buf.length;
    let i = 0;
    let start = 0;

    const append = (end: number) => {
      if (end > start) state.field += buf.toString(this.encoding, start, end);
    };

    while (i < len) {
      const byte = buf[i];

      if (state.inQuotes) {
        i = this.handleInsideQuotes(
          buf,
          i,
          len,
          state,
          append,
          (s) => (start = s),
        );
        continue;
      }

      if (this.quote !== null && byte === this.quote) {
        append(i);
        state.inQuotes = true;
        state.dirty = true;
        start = i + 1;
        i += 1;
        continue;
      }

      if (byte === this.delimiter) {
        append(i);
        state.row.push(state.field);
        state.field = "";
        state.dirty = true;
        start = i + 1;
        i += 1;
        continue;
      }

      if (byte === LF || byte === CR) {
        append(i);
        i = this.skipEol(buf, i, len, byte);
        start = i;

        if (state.dirty || state.field.length > 0 || state.row.length > 0) {
          state.row.push(state.field);
          const finished = state.row as T;
          state.field = "";
          state.row = [];
          state.dirty = false;

          if (!this.firstKeysRow) {
            this.firstKeysRow = finished;
          }

          yield finished;
        }
        continue;
      }

      state.dirty = true;
      i += 1;
    }

    append(len);
  }

  private handleInsideQuotes(
    buf: Buffer,
    i: number,
    len: number,
    state: ParserState,
    append: (end: number) => void,
    setStart: (s: number) => void,
  ): number {
    if (this.quote === null || buf[i] !== this.quote) return i + 1;

    const isEscaped = i + 1 < len && buf[i + 1] === this.quote;
    if (isEscaped) {
      append(i + 1);
      setStart(i + 2);
      return i + 2;
    }

    append(i);
    state.inQuotes = false;
    setStart(i + 1);
    return i + 1;
  }

  private skipEol(buf: Buffer, i: number, len: number, byte: number): number {
    const next = i + 1;
    if (byte === CR && next < len && buf[next] === LF) return next + 1;
    return next;
  }
}

 