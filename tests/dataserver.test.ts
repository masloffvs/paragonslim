import "reflect-metadata";
import { test, expect } from "bun:test";
import { DataServer, createDataServer } from "../src/query/dataserver";
import { Stage } from "../src/query/stage";
import { Source } from "../src/query/sources/source";
import { Transformation } from "../src/query/transformation";
import { PassThroughTransformer } from "../src/query/sources/passThroughTransformer";
import { StreamCSVSource } from "../src/query/sources/streamCSV";
import { Context } from "../src/query/sources/context";
import { writeFileSync, unlinkSync } from "fs";

class MockSource extends Source {
  constructor(private rows: any[]) {
    super("");
  }
  public override async execute<T, R extends any[]>(prevResults: R): Promise<T | null | undefined> {
    return this.rows as T;
  }
}

test("DataServer - basic pipeline with PassThroughTransformer and Transformation", async () => {
  const server = createDataServer({} as Context);
  const result = await server.call([
    new Stage(new MockSource([{ id: 1, val: "a" }, { id: 2, val: "b" }]), new Transformation(row => ({ ...row, val: row.val.toUpperCase() }))),
    new Stage(new PassThroughTransformer(), new Transformation(row => ({ ...row, processed: true }))),
  ]);

  expect(result).toEqual([
    { id: 1, val: "A", processed: true },
    { id: 2, val: "B", processed: true },
  ]);
});

test("DataServer - destination callback receives rows and avoids stack collection", async () => {
  const server = createDataServer({} as Context);
  const received: any[] = [];

  const largeRows = Array.from({ length: 1500 }, (_, i) => ({ id: i }));

  const result = await server.destination(row => {
    received.push(row);
  }).call([
    new Stage(new MockSource(largeRows), new Transformation())
  ]);

  expect(received.length).toBe(1500);
  expect(received[0]).toEqual({ id: 0 });
  expect(received[1499]).toEqual({ id: 1499 });
});

test("DataServer - stack collection throws stack overflow when > 1000 elements", async () => {
  const server = createDataServer({} as Context);
  const largeRows = Array.from({ length: 1001 }, (_, i) => ({ id: i }));

  let error: any = null;
  try {
    await server.call([
      new Stage(new MockSource(largeRows), new Transformation())
    ]);
  } catch (e) {
    error = e;
  }

  expect(error).toBeDefined();
  expect(error.message).toContain("Collected more than");
});

test("DataServer - stack collection succeeds when <= 1000 elements", async () => {
  const server = createDataServer({} as Context);
  const rows = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

  const result = await server.call([
    new Stage(new MockSource(rows), new Transformation())
  ]);

  expect(result.length).toBe(1000);
});

test("DataServer - destination with StreamCSVSource streams row by row", async () => {
  const testData = "id,name\n1,Alice\n2,Bob";
  const testFile = "./test_server_stream.csv";
  writeFileSync(testFile, testData);

  const server = createDataServer({} as Context);
  const received: any[] = [];

  await server.destination(row => {
    received.push(row);
  }).call([
    new Stage(new StreamCSVSource(testFile), new Transformation(row => ({ ...row, processed: true })))
  ]);

  expect(received).toHaveLength(2);
  expect(received[0]).toEqual({ id: 1, name: "Alice", processed: true });
  expect(received[1]).toEqual({ id: 2, name: "Bob", processed: true });

  unlinkSync(testFile);
});

test("DataServer - preview with negative confirmation does not reach destination fully", async () => {
  const testData = "id,name\n1,Alice\n2,Bob\n3,Charlie";
  const testFile = "./test_preview_no.csv";
  writeFileSync(testFile, testData);

  const server = createDataServer({} as Context);
  server.setConfirmation(async () => false);
  const received: any[] = [];

  await server.destination(row => {
    received.push(row);
  }).preview(2).call([
    new Stage(new StreamCSVSource(testFile), new Transformation())
  ]);

  expect(received).toHaveLength(0);

  unlinkSync(testFile);
});

test("DataServer - preview with positive confirmation restarts and reaches destination", async () => {
  const testData = "id,name\n1,Alice\n2,Bob\n3,Charlie";
  const testFile = "./test_preview_yes.csv";
  writeFileSync(testFile, testData);

  const server = createDataServer({} as Context);
  server.setConfirmation(async () => true);
  const received: any[] = [];

  await server.preview(2).destination(row => {
    received.push(row);
  }).call([
    new Stage(new StreamCSVSource(testFile), new Transformation())
  ]);

  expect(received).toHaveLength(3);
  expect(received[0]).toEqual({ id: 1, name: "Alice" });
  expect(received[1]).toEqual({ id: 2, name: "Bob" });
  expect(received[2]).toEqual({ id: 3, name: "Charlie" });

  unlinkSync(testFile);
});

test("DataServer - destinationBatch receives rows in batches", async () => {
  const server = createDataServer({} as Context);
  const batches: any[][] = [];

  const rows = Array.from({ length: 10 }, (_, i) => ({ id: i, val: `row${i}` }));

  await server.destinationBatch((batch) => {
    batches.push(batch);
  }, 3).call([
    new Stage(new MockSource(rows), new Transformation())
  ]);

  expect(batches.length).toBe(4);
  expect(batches[0]).toHaveLength(3);
  expect(batches[1]).toHaveLength(3);
  expect(batches[2]).toHaveLength(3);
  expect(batches[3]).toHaveLength(1);
  expect(batches[3][0]).toEqual({ id: 9, val: "row9" });
});

test("DataServer - destinationBatch with preview restores batch callback", async () => {
  const testData = "id,name\n1,Alice\n2,Bob\n3,Charlie";
  const testFile = "./test_batch_preview.csv";
  writeFileSync(testFile, testData);

  const server = createDataServer({} as Context);
  server.setConfirmation(async () => true);
  const batches: any[][] = [];

  await server.destinationBatch((batch) => {
    batches.push(batch);
  }, 2).preview(2).call([
    new Stage(new StreamCSVSource(testFile), new Transformation())
  ]);

  expect(batches.length).toBe(2);
  expect(batches[0]).toHaveLength(2);
  expect(batches[1]).toHaveLength(1);
  expect(batches[0][0]).toEqual({ id: 1, name: "Alice" });
  expect(batches[0][1]).toEqual({ id: 2, name: "Bob" });
  expect(batches[1][0]).toEqual({ id: 3, name: "Charlie" });

  unlinkSync(testFile);
});

