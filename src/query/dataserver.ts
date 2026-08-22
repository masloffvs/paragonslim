import { Context } from "./sources/context";
import { Stage } from "./stage";
import {
  PassThroughTransformer,
  PassThroughTransformerSource,
} from "./sources/passThroughTransformer";
import * as readline from "node:readline";
import $logger from "../pino";
import { createHash } from "crypto";

export { PassThroughTransformer, PassThroughTransformerSource };

interface StreamableSource {
  streamRows(): AsyncGenerator<any>;
}

function isStreamableSource(source: unknown): source is StreamableSource {
  return !!source && typeof (source as any).streamRows === "function";
}

export class MemoryLimitExceededError extends Error {
  constructor(limit: number) {
    super(
      `Collected more than ${limit} elements in memory without a destination. ` +
        `Use .destination() to stream results instead of returning the full array.`,
    );
    this.name = "MemoryLimitExceededError";
  }
}

const DEFAULT_BATCH_SIZE = 5000;
const DEFAULT_MEMORY_LIMIT = 1000;
const BATCH_RAM_ALLOCATE = 2 * 1024 * 1024 * 1024;

function generateShardKey(primaryKeyValue: any, uniqKeyValues?: Record<string, any>): string {
  const values = [primaryKeyValue];
  if (uniqKeyValues) {
    Object.values(uniqKeyValues).forEach(v => values.push(v));
  }
  const hash = createHash('md5').update(JSON.stringify(values)).digest('hex');
  return hash.substring(0, 6) + hash.substring(hash.length - 4);
}

function calculateDynamicBatchSize(rows: any[], ramLimit: number = BATCH_RAM_ALLOCATE): number {
  if (rows.length === 0) return DEFAULT_BATCH_SIZE;
  
  const sampleSize = Math.min(rows.length, 100);
  const sample = rows.slice(0, sampleSize);
  
  let totalSize = 0;
  for (const row of sample) {
    totalSize += JSON.stringify(row).length;
  }
  
  const avgRowSize = totalSize / sampleSize;
  const maxBatchSize = Math.floor(ramLimit / avgRowSize);
  
  return Math.max(DEFAULT_BATCH_SIZE, Math.min(maxBatchSize, 100000));
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class DataServer {
  private destinationFn: ((row: any) => void) | null = null;
  private batchDestinationFn: ((rows: any[]) => void | Promise<void>) | null = null;
  private batchDestinationSize: number = 10000;
  private previewLimit: number | null = null;
  private confirmationFn: (() => Promise<boolean>) | null = null;
  private batchSizeValue: number = DEFAULT_BATCH_SIZE;
  private memoryLimit: number = DEFAULT_MEMORY_LIMIT;
  private writeSchemas: Map<string, { keys: string[]; types: Map<string, string> }> = new Map();

  constructor(private initContext: Context) {}

  async write(
    rows: any[],
    options: {
      dataset: string;
      loadBalancer?: (dataset: string, row: any, nodes: string[]) => string | Promise<string>;
      uniqKeys?: string[];
      primaryKey?: string[];
    },
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error("DataServer.write expects a non-empty array of rows");
    }

    const datasetName = options.dataset;
    $logger.debug(`DataServer.write: starting batch write for dataset '${datasetName}' with ${rows.length} rows`);

    const ch = this.initContext.ch;
    const nodes = "clients" in ch && ch.clients instanceof Map ? Array.from(ch.clients.keys()) : [];
    $logger.debug(`DataServer.write: available ClickHouse nodes: ${nodes.join(", ")}`);

    if (nodes.length === 0) {
      throw new Error("No ClickHouse nodes available for writing");
    }

    let schema = this.writeSchemas.get(datasetName);
    if (!schema) {
      const firstRow = rows[0];
      if (typeof firstRow !== "object" || firstRow === null || Array.isArray(firstRow)) {
        throw new Error("DataServer.write expects array of objects");
      }
      const keys = Object.keys(firstRow);
      const types = new Map<string, string>();
      for (const key of keys) {
        types.set(key, typeof firstRow[key]);
      }
      schema = { keys, types };
      this.writeSchemas.set(datasetName, schema);
      $logger.debug(`DataServer.write: established schema for dataset '${datasetName}' with keys: ${keys.join(", ")}`);
    } else {
      $logger.debug(`DataServer.write: using cached schema for dataset '${datasetName}'`);
    }

    let primaryKey = options.primaryKey;
    
    if (!primaryKey) {
      const datasetSchema = this.initContext.datasetSchemas.get(datasetName);
      if (datasetSchema?.primaryKey) {
        primaryKey = datasetSchema.primaryKey;
        $logger.debug(`DataServer.write: using primaryKey from dataset schema: ${primaryKey.join(', ')}`);
      }
    }
    
    if (!primaryKey) {
      primaryKey = schema.keys.slice(0, 1);
      $logger.debug(`DataServer.write: using fallback primaryKey from schema: ${primaryKey.join(', ')}`);
    }

    for (const row of rows) {
      const pkValue = row[primaryKey[0]];
      const uniqKeyValues: Record<string, any> = {};
      
      for (let i = 1; i < primaryKey.length; i++) {
        const key = primaryKey[i];
        if (row[key] !== undefined && row[key] !== null) {
          uniqKeyValues[key] = row[key];
        }
      }
      
      const generatedId = generateShardKey(pkValue, Object.keys(uniqKeyValues).length > 0 ? uniqKeyValues : undefined);
      $logger.debug(`DataServer.write: generated ID '${generatedId}' for row with pkValue='${pkValue}' and uniqKeys=${JSON.stringify(uniqKeyValues)}`);
      row.id = generatedId;
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        throw new Error(`Row ${i} in write batch is not an object`);
      }
      const keys = Object.keys(row);
      if (keys.length !== schema.keys.length) {
        throw new Error(`Row ${i} has different number of keys than expected by first batch`);
      }
      for (const key of schema.keys) {
        if (!keys.includes(key)) {
          throw new Error(`Row ${i} is missing key '${key}'`);
        }
      }
    }
    $logger.debug(`DataServer.write: validated ${rows.length} rows against schema successfully`);

    const dynamicBatchSize = calculateDynamicBatchSize(rows, BATCH_RAM_ALLOCATE);
    $logger.debug(`DataServer.write: calculated dynamic batch size: ${dynamicBatchSize} based on ${BATCH_RAM_ALLOCATE / (1024 * 1024 * 1024)}GB RAM limit`);

    const nodeBatches = new Map<string, any[]>();

    for (const row of rows) {
      const pkValues: any[] = [];
      
      for (const key of primaryKey) {
        if (row[key] !== undefined && row[key] !== null) {
          pkValues.push(row[key]);
        }
      }
      
      if (pkValues.length === 0) {
        throw new Error(`Row is missing primary key fields: ${primaryKey.join(', ')}`);
      }

      let targetNode: string;
      if (options.loadBalancer) {
        targetNode = await options.loadBalancer(datasetName, row, nodes);
      } else {
        const pkValue = pkValues[0];
        if (pkValue === undefined) {
          throw new Error(`Row is missing primary key field: ${primaryKey[0]}`);
        }
        const index =
          Math.abs(
            String(pkValue)
              .split("")
              .reduce((acc, char) => acc + char.charCodeAt(0), 0),
          ) % nodes.length;
        targetNode = nodes[index] as string;
      }

      if (!nodeBatches.has(targetNode)) {
        nodeBatches.set(targetNode, []);
      }
      
      const currentBatch = nodeBatches.get(targetNode)!;
      if (currentBatch.length >= dynamicBatchSize) {
        await this.processBatch(ch, datasetName, targetNode, currentBatch, primaryKey);
        nodeBatches.set(targetNode, []);
      }
      
      nodeBatches.get(targetNode)!.push(row);
    }

    for (const [targetNode, nodeRows] of nodeBatches) {
      if (nodeRows.length > 0) {
        await this.processBatch(ch, datasetName, targetNode, nodeRows, primaryKey);
      }
    }
    
    $logger.debug(`DataServer.write: successfully completed batch write of ${rows.length} rows for dataset '${datasetName}' with dynamic batch size ${dynamicBatchSize} across ${nodeBatches.size} node(s)`);
  }

  private async processBatch(
    ch: any,
    datasetName: string,
    targetNode: string,
    nodeRows: any[],
    primaryKey: string[]
  ): Promise<void> {
    const client = "clients" in ch && ch.clients instanceof Map ? ch.clients.get(targetNode) : null;
    if (!client) {
      throw new Error(`Client for node ${targetNode} not found`);
    }


    $logger.debug(`DataServer.processBatch: inserting ${nodeRows.length} rows into dataset '${datasetName}' on ClickHouse node '${targetNode}'`);
    try {
      await client.insert({
        table: datasetName,
        values: nodeRows,
        format: "JSONEachRow",
      });
      $logger.debug(`DataServer.processBatch: successfully inserted ${nodeRows.length} rows into '${datasetName}' on node '${targetNode}' via client.insert`);
    } catch (err) {
      $logger.debug(`DataServer.processBatch: batch insert failed on node '${targetNode}' (${err}), falling back to individual SQL INSERTs`);
      for (const row of nodeRows) {
        try {
          const columns = Object.keys(row).join(", ");
          const values = Object.values(row)
            .map((v) => {
              if (v === null || v === undefined) return "NULL";
              if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
              if (typeof v === "boolean") return v ? "1" : "0";
              return String(v);
            })
            .join(", ");
          await client.command({
            query: `INSERT INTO ${datasetName} (${columns}) VALUES (${values})`,
          });
          $logger.debug(`DataServer.processBatch: successfully inserted row into '${datasetName}' on node '${targetNode}' via fallback SQL INSERT`);
        } catch (rowErr) {
          $logger.debug(`DataServer.processBatch: failed to insert row into '${datasetName}' on node '${targetNode}': ${rowErr}`);
        }
      }
    }
  }

  public destination(fn: (row: any) => void): this {
    $logger.debug("DataServer: destination callback configured");
    this.destinationFn = fn;
    return this;
  }

  public destinationBatch(fn: (rows: any[]) => void | Promise<void>, batchSize?: number): this {
    $logger.debug("DataServer: batched destination callback configured");
    this.batchDestinationFn = fn;
    if (batchSize) {
      this.batchDestinationSize = batchSize;
    }
    return this;
  }

  public preview(count: number): this {
    $logger.debug(`DataServer: preview limit configured to ${count}`);
    this.previewLimit = count;
    return this;
  }

  public setConfirmation(fn: () => Promise<boolean>): this {
    $logger.debug("DataServer: custom confirmation function configured");
    this.confirmationFn = fn;
    return this;
  }

  public batchSize(size: number): this {
    $logger.debug(`DataServer: batch size configured to ${size}`);
    this.batchSizeValue = size;
    return this;
  }

  public maxInMemory(limit: number): this {
    $logger.debug(`DataServer: memory limit configured to ${limit}`);
    this.memoryLimit = limit;
    return this;
  }

  private async confirm(): Promise<boolean> {
    if (this.confirmationFn) {
      return await this.confirmationFn();
    }
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    return new Promise((resolve) => {
      rl.question("Continue? (Y/n): ", (answer) => {
        rl.close();
        const trimmed = answer.trim().toLowerCase();
        resolve(trimmed === "y" || trimmed === "yes");
      });
    });
  }

  private async *runPipeline(
    stages: readonly Stage[],
    previewLimit: number | null,
  ): AsyncGenerator<any> {
    $logger.debug(`DataServer.runPipeline: starting pipeline execution (previewLimit=${previewLimit})`);
    const firstSource = stages[0]?.getSource();

    if (!isStreamableSource(firstSource)) {
      $logger.debug(`DataServer.runPipeline: first source is not streamable, falling back to runInMemory`);
      yield* this.runInMemory(stages, previewLimit);
      return;
    }

    $logger.debug(`DataServer.runPipeline: streaming source detected, processing row-by-row`);
    const transformer = stages[0].getTransformer();
    let rawBatch: any[] = [];
    let emitted = 0;
    
    const pipelineBatchSize = 10000;

    const flushBatch = async (): Promise<any[]> => {
      if (rawBatch.length === 0) return [];
      $logger.debug(`DataServer.runPipeline: flushing batch of size ${rawBatch.length}`);
      
      let currentResults: any = rawBatch;
      rawBatch = [];

      for (let i = 1; i < stages.length; i++) {
        currentResults = await stages[i].execute(currentResults);
        if (currentResults === null || currentResults === undefined) return [];
      }

      return Array.isArray(currentResults) ? currentResults : [currentResults];
    };

    for await (const rawRow of firstSource.streamRows()) {
      if (previewLimit !== null && emitted >= previewLimit) break;

      const transformed = transformer.transform(rawRow);
      if (transformed === null || transformed === undefined) continue;

      rawBatch.push(transformed);

      if (rawBatch.length >= pipelineBatchSize) {
        for (const row of await flushBatch()) {
          if (row === null || row === undefined) continue;
          yield row;
          emitted++;
          if (previewLimit !== null && emitted >= previewLimit) return;
        }
      }
    }

    for (const row of await flushBatch()) {
      if (row === null || row === undefined) continue;
      yield row;
      emitted++;
      if (previewLimit !== null && emitted >= previewLimit) return;
    }
    $logger.debug(`DataServer.runPipeline: finished streaming pipeline execution (emitted ${emitted} rows)`);
  }

  private async *runInMemory(
    stages: readonly Stage[],
    previewLimit: number | null,
  ): AsyncGenerator<any> {
    $logger.debug(`DataServer.runInMemory: executing pipeline in-memory (previewLimit=${previewLimit})`);
    let prevResults: any[] = [];
    for (const stage of stages) {
      prevResults = (await stage.execute(prevResults)) ?? [];
    }

    const rows = Array.isArray(prevResults) ? prevResults : [prevResults];
    const limited = previewLimit !== null ? rows.slice(0, previewLimit) : rows;
    $logger.debug(`DataServer.runInMemory: completed in-memory execution, yielding ${limited.length} rows`);

    for (const row of limited) {
      if (row !== null && row !== undefined) yield row;
    }
  }

  async call(stages: readonly Stage[]) {
    $logger.debug(`DataServer.call: starting pipeline call with ${stages.length} stages`);
    for (const stage of stages) {
      stage.bindContext(this.initContext);
    }

    const hasDestination = this.destinationFn !== null;
    const dest = this.destinationFn ?? ((it: any) => console.log(it));
    const hasBatchDestination = this.batchDestinationFn !== null;
    const savedBatchDest = this.batchDestinationFn;
    const savedBatchSize = this.batchDestinationSize;
    const previewLimit = this.previewLimit;

    this.destinationFn = null;
    this.previewLimit = null;
    this.batchDestinationFn = null;
    this.batchDestinationSize = DEFAULT_BATCH_SIZE;

    if (previewLimit !== null) {
      $logger.debug(`DataServer.call: running preview phase with limit ${previewLimit}`);
      for await (const row of this.runPipeline(stages, previewLimit)) {
        console.log("PREVIEW", row);
      }

      $logger.debug(`DataServer.call: awaiting user confirmation after preview`);
      const confirmed = await this.confirm();
      $logger.debug(`DataServer.call: user confirmation result: ${confirmed}`);
      if (!confirmed) {
        return [];
      }

      if (hasDestination) {
        this.destinationFn = dest;
      }
      if (hasBatchDestination) {
        this.batchDestinationFn = savedBatchDest;
        this.batchDestinationSize = savedBatchSize;
      }
      return await this.call(stages);
    }

    if (hasDestination) {
      $logger.debug(`DataServer.call: running pipeline with destination callback`);
      for await (const row of this.runPipeline(stages, null)) {
        dest(row);
      }
      $logger.debug(`DataServer.call: completed pipeline with destination callback`);
      return [];
    }

    if (hasBatchDestination) {
      $logger.debug(`DataServer.call: running pipeline with batched destination callback`);
      const buffer: any[] = [];
      for await (const row of this.runPipeline(stages, null)) {
        buffer.push(row);
        if (buffer.length >= savedBatchSize) {
          const batch = buffer.splice(0, buffer.length);
          await savedBatchDest(batch);
        }
      }
      if (buffer.length > 0) {
        await savedBatchDest(buffer);
      }
      $logger.debug(`DataServer.call: completed pipeline with batched destination callback`);
      return [];
    }

    $logger.debug(`DataServer.call: collecting pipeline results in memory (with maxInMemory limit ${this.memoryLimit})`);
    const collected: any[] = [];
    for await (const row of this.runPipeline(stages, null)) {
      collected.push(row);
      if (collected.length > this.memoryLimit) {
        throw new MemoryLimitExceededError(this.memoryLimit);
      }
    }
    $logger.debug(`DataServer.call: successfully collected ${collected.length} rows in memory`);

    return collected;
  }
}

export function createDataServer(initContext: Context): DataServer {
  return new DataServer(initContext);
}
