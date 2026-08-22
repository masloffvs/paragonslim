import { expect, test } from "bun:test";
import { BasicDeenthropyTransformer } from "../src/query/transformers/basicDeenthropyTransformer";

test("BasicDeenthropyTransformer - phone field variants collapse to phone", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ phon: "1234567890" })).toEqual({
    phone: "1234567890"
  });

  expect(transformer.transform({ phoneNumber: "1234567890" })).toEqual({
    phone: "1234567890"
  });
  
  expect(transformer.transform({ phone_number: "1234567890" })).toEqual({
    phone: "1234567890"
  });
  
  expect(transformer.transform({ tel: "1234567890" })).toEqual({
    phone: "1234567890"
  });
});

test("BasicDeenthropyTransformer - email field variants collapse to email", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ emailAddress: "TEST@EXAMPLE.COM" })).toEqual({
    email: "test@example.com"
  });
  
  expect(transformer.transform({ email_address: "TEST@EXAMPLE.COM" })).toEqual({
    email: "test@example.com"
  });
  
  expect(transformer.transform({ mail: "TEST@EXAMPLE.COM" })).toEqual({
    email: "test@example.com"
  });
});

test("BasicDeenthropyTransformer - name field variants collapse to name", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ fullName: "  John   Doe  " })).toEqual({
    name: "John Doe"
  });
  
  expect(transformer.transform({ user_name: "  John   Doe  " })).toEqual({
    name: "John Doe"
  });
});

test("BasicDeenthropyTransformer - id field variants collapse to id", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ userId: 123 })).toEqual({
    id: 123
  });
  
  expect(transformer.transform({ identifier: 123 })).toEqual({
    id: 123
  });
});

test("BasicDeenthropyTransformer - age field variants collapse to age", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ yearsOld: 25 })).toEqual({
    age: 25
  });
  
  expect(transformer.transform({ years: 25 })).toEqual({
    age: 25
  });
});

test("BasicDeenthropyTransformer - address field variants collapse to address", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ streetAddress: "123 Main St" })).toEqual({
    address: "123 Main St"
  });
  
  expect(transformer.transform({ location: "123 Main St" })).toEqual({
    address: "123 Main St"
  });
});

test("BasicDeenthropyTransformer - date field variants collapse to date", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ createdAt: "2024-01-01" })).toEqual({
    date: "2024-01-01"
  });
  
  expect(transformer.transform({ timestamp: "2024-01-01" })).toEqual({
    date: "2024-01-01"
  });
});

test("BasicDeenthropyTransformer - unknown keys remain in camelCase", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ custom_field: "value" })).toEqual({
    customField: "value"
  });
  
  expect(transformer.transform({ AnotherField: "value" })).toEqual({
    anotherfield: "value"
  });
});

test("BasicDeenthropyTransformer - null and undefined values preserved", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ phone: null })).toEqual({
    phone: null
  });
  
  expect(transformer.transform({ email: undefined })).toEqual({
    email: undefined
  });
});

test("BasicDeenthropyTransformer - non-object values returned as-is", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform(null)).toBe(null);
  expect(transformer.transform(undefined)).toBe(undefined);
  expect(transformer.transform("string")).toBe("string");
  expect(transformer.transform(123)).toBe(123);
});

test("BasicDeenthropyTransformer - complex row with multiple fields", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  const result = transformer.transform({
    phoneNumber: "1234567890",
    emailAddress: "TEST@EXAMPLE.COM",
    fullName: "  John   Doe  ",
    userId: 123,
    custom_field: "value"
  });
  
  expect(result).toEqual({
    phone: "1234567890",
    email: "test@example.com",
    name: "John Doe",
    id: 123,
    customField: "value"
  });
});

test("BasicDeenthropyTransformer - phone normalization with international format", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ phone: "441234567890" })).toEqual({
    phone: "441234567890"
  });
  
  expect(transformer.transform({ phone: "+44 123 456 7890" })).toEqual({
    phone: "441234567890"
  });
});

test("BasicDeenthropyTransformer - phone normalization with Russian format", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ phone: "+79987616611" })).toEqual({
    phone: "79987616611"
  });
  
  expect(transformer.transform({ phone: "79987616611" })).toEqual({
    phone: "79987616611"
  });
  
  expect(transformer.transform({ phone: "89987616611" })).toEqual({
    phone: "79987616611"
  });
  
  expect(transformer.transform({ phone: "+7 (998) 761-66-11" })).toEqual({
    phone: "79987616611"
  });
});

test("BasicDeenthropyTransformer - invalid phone numbers returned as-is", () => {
  const transformer = new BasicDeenthropyTransformer();
  
  expect(transformer.transform({ phone: "123" })).toEqual({
    phone: "123"
  });
  
  expect(transformer.transform({ phone: "1234567890123456" })).toEqual({
    phone: "1234567890123456"
  });
});

test("BasicDeenthropyTransformer - performance with large dataset", () => {
  const transformer = new BasicDeenthropyTransformer();
  const largeData = Array.from({ length: 10000 }, (_, i) => ({
    phoneNumber: `123456789${i % 10}`,
    emailAddress: `USER${i}@EXAMPLE.COM`,
    fullName: `  User   ${i}  `,
    custom_field: `value${i}`
  }));

  const start = performance.now();
  const result = largeData.map(row => transformer.transform(row));
  const end = performance.now();

  expect(result).toHaveLength(10000);
  expect(result[0]).toEqual({
    phone: "1234567890",
    email: "user0@example.com",
    name: "User 0",
    customField: "value0"
  });
  console.log(`  BasicDeenthropyTransformer - Processed 10000 records in ${(end - start).toFixed(0)}ms`);
  expect(end - start).toBeLessThan(1000);
});
