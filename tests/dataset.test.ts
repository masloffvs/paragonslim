import "reflect-metadata";
import { expect, test } from "bun:test";
import { defineDataset } from "../src/servers/dataset";

test("defineDataset - valid dataset", () => {
  const dataset = defineDataset({
    name: "TestTable",
    version: "001",
    row: {
      phone: { type: "String" },
      email: { type: "String" },
      name: { type: "String" }
    }
  });

  expect(dataset).toBeDefined();
  expect(dataset.define.name).toBe("TestTable");
});

test("defineDataset - rejects conflicting phone keys", () => {
  expect(() => {
    defineDataset({
      name: "TestTable",
      version: "001",
      row: {
        phone: { type: "String" },
        phoneNumber: { type: "String" }
      }
    });
  }).toThrow("Key 'phoneNumber' conflicts with 'phone' - both collapse to 'phone'");
});

test("defineDataset - rejects conflicting email keys", () => {
  expect(() => {
    defineDataset({
      name: "TestTable",
      version: "001",
      row: {
        email: { type: "String" },
        emailAddress: { type: "String" }
      }
    });
  }).toThrow("Key 'emailAddress' conflicts with 'email' - both collapse to 'email'");
});

test("defineDataset - rejects multiple conflicting keys", () => {
  expect(() => {
    defineDataset({
      name: "TestTable",
      version: "001",
      row: {
        phone: { type: "String" },
        phone_number: { type: "String" },
        numberOfPhone: { type: "String" }
      }
    });
  }).toThrow(/conflicts with/);
});

test("defineDataset - allows different canonical keys", () => {
  const dataset = defineDataset({
    name: "TestTable",
    version: "001",
    row: {
      phone: { type: "String" },
      email: { type: "String" },
      name: { type: "String" },
      age: { type: "Int64" }
    }
  });

  expect(dataset).toBeDefined();
});

test("defineDataset - auto-adds id column if missing", () => {
  const dataset = defineDataset({
    name: "TestTable",
    version: "001",
    row: {
      phone: { type: "String" },
      email: { type: "String" }
    }
  });

  expect(dataset).toBeDefined();
  expect(dataset.define.row).toHaveProperty("id");
  expect(dataset.define.row?.id?.type).toBe("UUID");
  expect(dataset.define.row?.id?.nullable).toBe(false);
});

test("defineDataset - accepts valid primaryKey", () => {
  const dataset = defineDataset({
    name: "TestTable",
    version: "001",
    primaryKey: "userId",
    row: {
      userId: { type: "String" },
      name: { type: "String" }
    }
  });
  expect(dataset).toBeDefined();
  expect(dataset.define.primaryKey).toBe("userId");
});

test("defineDataset - rejects undefined primaryKey", () => {
  expect(() => {
    defineDataset({
      name: "TestTable",
      version: "001",
      primaryKey: "missingKey",
      row: {
        userId: { type: "String" }
      }
    });
  }).toThrow("Primary key 'missingKey' is not defined in dataset rows.");
});
