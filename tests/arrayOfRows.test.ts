import { expect, test } from "bun:test";
import { ArrayOfRowsSource } from "../src/query/sources/arrayOfRows";

test("ArrayOfRowsSource - valid data structure", () => {
  const validData = [
    { id: 1, name: "Alice", age: 30, active: true },
    { id: 2, name: "Bob", age: 25, active: false },
    { id: 3, name: "Charlie", age: 35, active: true }
  ];

  const source = new ArrayOfRowsSource(validData);
  expect(source).toBeDefined();
});

test("ArrayOfRowsSource - empty array throws error", () => {
  expect(() => {
    new ArrayOfRowsSource([]);
  }).toThrow("ArrayOfRowsSource cannot be empty");
});

test("ArrayOfRowsSource - non-array throws error", () => {
  expect(() => {
    new ArrayOfRowsSource({} as any);
  }).toThrow("ArrayOfRowsSource expects an array of objects");
});

test("ArrayOfRowsSource - array of primitives throws error", () => {
  expect(() => {
    new ArrayOfRowsSource([1, 2, 3] as any);
  }).toThrow("ArrayOfRowsSource expects array of objects, not arrays or primitives");
});

test("ArrayOfRowsSource - array of arrays throws error", () => {
  expect(() => {
    new ArrayOfRowsSource([[1, 2], [3, 4]] as any);
  }).toThrow("ArrayOfRowsSource expects array of objects, not arrays or primitives");
});

test("ArrayOfRowsSource - missing key throws error", () => {
  const invalidData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob" } // Missing 'age'
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidData);
  }).toThrow("Row 1 has different number of keys than first row");
});

test("ArrayOfRowsSource - different key name throws error", () => {
  const invalidData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, surname: "Bob", age: 25 } // Different key name instead of 'name'
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidData);
  }).toThrow("Row 1 is missing key 'name'");
});

test("ArrayOfRowsSource - different number of keys throws error", () => {
  const invalidData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25, extra: "field" } // Extra key
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidData);
  }).toThrow("Row 1 has different number of keys than first row");
});

test("ArrayOfRowsSource - type mismatch throws error", () => {
  const invalidData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: "25" } // String instead of number
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidData);
  }).toThrow("Row 1, key 'age': type mismatch");
});

test("ArrayOfRowsSource - null values are allowed", () => {
  const nullableData = [
    { id: 1, name: "Alice", age: 30, active: true },
    { id: 2, name: "Bob", age: null, active: false },
    { id: 3, name: "Charlie", age: 35, active: null }
  ];

  const source = new ArrayOfRowsSource(nullableData);
  expect(source).toBeDefined();
});

test("ArrayOfRowsSource - undefined values are allowed", () => {
  const nullableData = [
    { id: 1, name: "Alice", age: 30, active: true },
    { id: 2, name: "Bob", age: undefined, active: false },
    { id: 3, name: "Charlie", age: 35, active: undefined }
  ];

  const source = new ArrayOfRowsSource(nullableData);
  expect(source).toBeDefined();
});

test("ArrayOfRowsRowsSource - mixed null and undefined are allowed", () => {
  const mixedData = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: null },
    { id: 3, name: "Charlie", age: undefined }
  ];

  const source = new ArrayOfRowsSource(mixedData);
  expect(source).toBeDefined();
});

test("ArrayOfRowsSource - different data types", () => {
  const mixedTypes = [
    { id: 1, name: "Alice", age: 30, score: 95.5, active: true, joined: new Date() },
    { id: 2, name: "Bob", age: 25, score: 87.3, active: false, joined: new Date() },
    { id: 3, name: "Charlie", age: 35, score: 92.1, active: true, joined: new Date() }
  ];

  const source = new ArrayOfRowsSource(mixedTypes);
  expect(source).toBeDefined();
});

test("ArrayOfRowsSource - integer vs float distinction", () => {
  const numbers = [
    { id: 1, value: 10 },
    { id: 2, value: 20 }
  ];

  const source = new ArrayOfRowsSource(numbers);
  expect(source).toBeDefined();

  const mixedNumbers = [
    { id: 1, value: 10 },
    { id: 2, value: 20.5 }
  ];

  expect(() => {
    new ArrayOfRowsSource(mixedNumbers);
  }).toThrow("Row 1, key 'value': type mismatch");
});

test("ArrayOfRowsSource - execute returns data", async () => {
  const data = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 }
  ];

  const source = new ArrayOfRowsSource(data);
  const result = await source.execute<any, any[]>([]);

  expect(result).toEqual(data);
});

test("ArrayOfRowsSource - single row", () => {
  const singleRow = [
    { id: 1, name: "Alice", age: 30 }
  ];

  const source = new ArrayOfRowsSource(singleRow);
  expect(source).toBeDefined();
});

test("ArrayOfRowsSource - large dataset performance", () => {
  const largeData = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    name: `User${i}`,
    age: 20 + (i % 50),
    active: i % 2 === 0
  }));

  const start = performance.now();
  const source = new ArrayOfRowsSource(largeData);
  const end = performance.now();

  expect(source).toBeDefined();
  expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
});

test("ArrayOfRowsSource - boolean type validation", () => {
  const booleanData = [
    { id: 1, active: true },
    { id: 2, active: false }
  ];

  const source = new ArrayOfRowsSource(booleanData);
  expect(source).toBeDefined();

  const invalidBoolean = [
    { id: 1, active: true },
    { id: 2, active: "true" } // String instead of boolean
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidBoolean);
  }).toThrow("Row 1, key 'active': type mismatch");
});

test("ArrayOfRowsSource - string type validation", () => {
  const stringData = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const source = new ArrayOfRowsSource(stringData);
  expect(source).toBeDefined();

  const invalidString = [
    { id: 1, name: "Alice" },
    { id: 2, name: 123 } // Number instead of string
  ];

  expect(() => {
    new ArrayOfRowsSource(invalidString);
  }).toThrow("Row 1, key 'name': type mismatch");
});
