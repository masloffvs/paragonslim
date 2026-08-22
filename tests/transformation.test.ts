import { expect, test } from "bun:test";
import { Transformation } from "../src/query/transformation";

test("Transformation - with function applies transformation", () => {
  const data = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const transformation = new Transformation((row) => ({
    ...row,
    processed: true
  }));

  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual([
    { id: 1, name: "Alice", processed: true },
    { id: 2, name: "Bob", processed: true }
  ]);
});

test("Transformation - without function returns data as-is", () => {
  const data = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const transformation = new Transformation();
  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual(data);
});

test("Transformation - identity function is ignored", () => {
  const data = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const transformation = new Transformation((x) => x);
  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual(data);
});

test("Transformation - identity function with return is ignored", () => {
  const data = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const transformation = new Transformation((x) => { return x; });
  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual(data);
});

test("Transformation - empty function is ignored", () => {
  const data = [
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" }
  ];

  const transformation = new Transformation(() => {});
  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual(data);
});

test("Transformation - complex transformation is applied", () => {
  const data = [
    { id: 1, name: "Alice", age: 30 },
    { id: 2, name: "Bob", age: 25 }
  ];

  const transformation = new Transformation((row) => ({
    ...row,
    ageGroup: row.age > 28 ? 'senior' : 'junior',
    timestamp: new Date().toISOString()
  }));

  const result = data.map(row => transformation.transform(row));

  expect(result).toHaveLength(2);
  expect(result[0]).toHaveProperty('ageGroup', 'senior');
  expect(result[0]).toHaveProperty('timestamp');
  expect(result[1]).toHaveProperty('ageGroup', 'junior');
  expect(result[1]).toHaveProperty('timestamp');
});

test("Transformation - null function is handled", () => {
  const data = [
    { id: 1, name: "Alice" }
  ];

  const transformation = new Transformation(null);
  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual(data);
});

test("Transformation - filtering transformation", () => {
  const data = [
    { id: 1, name: "Alice", active: true },
    { id: 2, name: "Bob", active: false },
    { id: 3, name: "Charlie", active: true }
  ];

  const transformation = new Transformation((row) => 
    row.active ? row : null
  );

  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual([
    { id: 1, name: "Alice", active: true },
    null,
    { id: 3, name: "Charlie", active: true }
  ]);
});

test("Transformation - data modification", () => {
  const data = [
    { id: 1, name: "alice" },
    { id: 2, name: "bob" }
  ];

  const transformation = new Transformation((row) => ({
    ...row,
    name: row.name.toUpperCase()
  }));

  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual([
    { id: 1, name: "ALICE" },
    { id: 2, name: "BOB" }
  ]);
});

test("Transformation - adding computed fields", () => {
  const data = [
    { id: 1, price: 100, quantity: 2 },
    { id: 2, price: 50, quantity: 3 }
  ];

  const transformation = new Transformation((row) => ({
    ...row,
    total: row.price * row.quantity
  }));

  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual([
    { id: 1, price: 100, quantity: 2, total: 200 },
    { id: 2, price: 50, quantity: 3, total: 150 }
  ]);
});

test("Transformation - nested object transformation", () => {
  const data = [
    { id: 1, user: { name: "Alice", age: 30 } },
    { id: 2, user: { name: "Bob", age: 25 } }
  ];

  const transformation = new Transformation((row) => ({
    ...row,
    userName: row.user.name,
    userAge: row.user.age
  }));

  const result = data.map(row => transformation.transform(row));

  expect(result).toEqual([
    { id: 1, user: { name: "Alice", age: 30 }, userName: "Alice", userAge: 30 },
    { id: 2, user: { name: "Bob", age: 25 }, userName: "Bob", userAge: 25 }
  ]);
});

test("Transformation - performance with large dataset", () => {
  const largeData = Array.from({ length: 10000 }, (_, i) => ({
    id: i,
    value: i * 2
  }));

  const transformation = new Transformation((row) => ({
    ...row,
    doubled: row.value * 2
  }));

  const start = performance.now();
  const result = largeData.map(row => transformation.transform(row));
  const end = performance.now();

  expect(result).toHaveLength(10000);
  expect(result[0].doubled).toBe(0);
  expect(result[9999].doubled).toBe(39996);
  expect(end - start).toBeLessThan(100); // Should complete in less than 100ms
});

test("Transformation - performance with 1M records", () => {
  const millionData = Array.from({ length: 1000000 }, (_, i) => ({
    id: i,
    value: i * 2
  }));

  const transformation = new Transformation((row) => ({
    ...row,
    doubled: row.value * 2
  }));

  const start = performance.now();
  const result = millionData.map(row => transformation.transform(row));
  const end = performance.now();

  expect(result).toHaveLength(1000000);
  expect(result[0].doubled).toBe(0);
  expect(result[999999].doubled).toBe(3999996);
  console.log(`  Transformation - Processed 1000000 records in ${(end - start).toFixed(0)}ms`);
  expect(end - start).toBeLessThan(1000); // Should complete in less than 1 second
});
