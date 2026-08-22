import "reflect-metadata";
import { expect, test } from "bun:test";
import { StreamCSVSource } from "../src/query/sources/streamCSV";
import { writeFileSync, unlinkSync } from "fs";

test("StreamCSVSource - basic CSV parsing", async () => {
  const testData = "id,name,age\n1,Alice,30\n2,Bob,25\n3,Charlie,35";
  const testFile = "./test_basic.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(3);
  expect(result[0]).toEqual({ id: 1, name: "Alice", age: 30 });
  expect(result[1]).toEqual({ id: 2, name: "Bob", age: 25 });
  expect(result[2]).toEqual({ id: 3, name: "Charlie", age: 35 });

  unlinkSync(testFile);
});

test("StreamCSVSource - custom delimiter", async () => {
  const testData = "id;name;age\n1;Alice;30\n2;Bob;25";
  const testFile = "./test_delimiter.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile, ";");
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ id: 1, name: "Alice", age: 30 });

  unlinkSync(testFile);
});

test("StreamCSVSource - quoted values", async () => {
  const testData = 'id,name,description\n1,"Alice, Smith","Developer"\n2,"Bob, Jones","Manager"';
  const testFile = "./test_quoted.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0].name).toBe("Alice, Smith");
  expect(result[0].description).toBe("Developer");

  unlinkSync(testFile);
});

test("StreamCSVSource - boolean parsing", async () => {
  const testData = "id,name,active\n1,Alice,true\n2,Bob,false\n3,Charlie,true";
  const testFile = "./test_boolean.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(3);
  expect(result[0].active).toBe(true);
  expect(result[1].active).toBe(false);
  expect(result[2].active).toBe(true);

  unlinkSync(testFile);
});

test("StreamCSVSource - number parsing", async () => {
  const testData = "id,integer,float\n1,42,3.14\n2,100,2.718";
  const testFile = "./test_numbers.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0].integer).toBe(42);
  expect(result[0].float).toBe(3.14);
  expect(typeof result[0].integer).toBe("number");
  expect(typeof result[0].float).toBe("number");

  unlinkSync(testFile);
});

test("StreamCSVSource - empty values as null", async () => {
  const testData = "id,name,age\n1,Alice,30\n2,Bob,\n3,Charlie,35";
  const testFile = "./test_empty.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(3);
  expect(result[1].age).toBe(null);

  unlinkSync(testFile);
});

test("StreamCSVSource - large file streaming", async () => {
  const lines = ["id,name,age"];
  for (let i = 1; i <= 10000; i++) {
    lines.push(`${i},User${i},${20 + (i % 50)}`);
  }
  const testData = lines.join("\n");
  const testFile = "./test_large.csv";
  writeFileSync(testFile, testData);

  const start = performance.now();
  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);
  const end = performance.now();

  expect(result).toHaveLength(10000);
  expect(result[0]).toEqual({ id: 1, name: "User1", age: 21 });
  expect(result[9999]).toEqual({ id: 10000, name: "User10000", age: 20 });
  expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second

  unlinkSync(testFile);
});

test("StreamCSVSource - single row", async () => {
  const testData = "id,name,age\n1,Alice,30";
  const testFile = "./test_single.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({ id: 1, name: "Alice", age: 30 });

  unlinkSync(testFile);
});

test("StreamCSVSource - file not found error", async () => {
  const source = new StreamCSVSource("./nonexistent.csv");

  await expect(source.execute<any, any[]>([])).rejects.toThrow();
});

test("StreamCSVSource - escaped quotes", async () => {
  const testData = 'id,name,description\n1,"Alice ""Smith""","Developer"\n2,"Bob ""Jones""","Manager"';
  const testFile = "./test_escaped.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0].name).toBe('Alice "Smith"');
  expect(result[1].name).toBe('Bob "Jones"');

  unlinkSync(testFile);
});

test("StreamCSVSource - mixed types", async () => {
  const testData = "id,name,score,active,joined\n1,Alice,95.5,true,2024-01-15\n2,Bob,87.3,false,2024-02-20";
  const testFile = "./test_mixed.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0].id).toBe(1);
  expect(result[0].name).toBe("Alice");
  expect(result[0].score).toBe(95.5);
  expect(result[0].active).toBe(true);
  expect(result[0].joined).toBe("2024-01-15");

  unlinkSync(testFile);
});

test("StreamCSVSource - trailing newlines", async () => {
  const testData = "id,name,age\n1,Alice,30\n2,Bob,25\n\n";
  const testFile = "./test_trailing.csv";
  writeFileSync(testFile, testData);

  const source = new StreamCSVSource(testFile);
  const result = await source.execute<any, any[]>([]);

  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ id: 1, name: "Alice", age: 30 });
  expect(result[1]).toEqual({ id: 2, name: "Bob", age: 25 });

  unlinkSync(testFile);
});
