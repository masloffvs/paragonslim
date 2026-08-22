import "reflect-metadata";
import { test, expect } from "bun:test";
import { DecentralizedCoordinator } from "../src/query/coordinator";
import { createDataServer } from "../src/query/dataserver";
import { Context } from "../src/query/sources/context";

test("DecentralizedCoordinator - registers and retrieves primary key node mapping across nodes", async () => {
  const mockClients = new Map<string, any>();
  const dbCoordData = new Map<string, any[]>();

  const createMockClient = (nodeKey: string) => ({
    async query({ query }: { query: string }) {
      if (query.includes("SELECT")) {
        const rows = dbCoordData.get(nodeKey) || [];
        if (query.includes("primary_key_value = 'u999'")) {
          return { data: [] };
        }
        return { data: rows };
      }
      return {};
    },
    async insert({ table, values }: { table: string; values: any[] }) {
      if (table === "dataset_coordination") {
        if (!dbCoordData.has(nodeKey)) dbCoordData.set(nodeKey, []);
        const rows = dbCoordData.get(nodeKey)!;
        for (const v of values) {
          rows.push(v);
        }
      }
    }
  });

  mockClients.set("node1:8123", createMockClient("node1:8123"));
  mockClients.set("node2:8123", createMockClient("node2:8123"));

  const mockCh = {
    clients: mockClients,
    async query(q: string) {
      const results = [];
      for (const [k, c] of mockClients.entries()) {
        results.push({ server: k, result: await c.query({ query: q }) });
      }
      return results;
    }
  };

  await DecentralizedCoordinator.register(mockCh as any, "users", "u1", "node1:8123");
  
  const node1 = await DecentralizedCoordinator.getNode(mockCh as any, "users", "u1");
  expect(node1).toBe("node1:8123");

  const nodeMissing = await DecentralizedCoordinator.getNode(mockCh as any, "users", "u999");
  expect(nodeMissing).toBeNull();
});

test("DecentralizedCoordinator - syncs missing entries across nodes", async () => {
  const mockClients = new Map<string, any>();
  const dbData1 = [{ dataset: "users", primary_key_value: "u1", node: "node1:8123", uniq_key_values: "" }];
  const dbData2: any[] = []; // missing u1

  mockClients.set("node1:8123", {
    async query() { return { data: dbData1 }; },
    async insert({ values }: any) { dbData2.push(...values); }
  });
  mockClients.set("node2:8123", {
    async query() { return { data: dbData2 }; },
    async insert({ values }: any) { dbData2.push(...values); }
  });

  const mockCh = {
    clients: mockClients,
    async query() { return []; }
  };

  await DecentralizedCoordinator.sync(mockCh as any);
  expect(dbData2.length).toBe(1);
  expect(dbData2[0]).toEqual({ dataset: "users", primary_key_value: "u1", node: "node1:8123", uniq_key_values: "" });
});

test("DataServer - write validates first batch schema and subsequent batches", async () => {
  const mockClients = new Map<string, any>();
  const insertedData: any[] = [];
  const coordData: any[] = [];

  mockClients.set("node1:8123", {
    async query({ query }: { query: string }) {
      if (query.includes("SELECT")) {
        return { data: coordData };
      }
      return { data: [] };
    },
    async insert({ table, values }: { table: string; values: any[] }) {
      if (table === "dataset_coordination") {
        coordData.push(...values);
      } else {
        insertedData.push(...values);
      }
    }
  });

  const mockCh = {
    clients: mockClients,
    async query(q: string) {
      if (q.includes("SELECT")) {
        return [{ server: "node1:8123", result: { data: coordData } }];
      }
      return [];
    }
  };

  const server = createDataServer(new Context(mockCh as any));

  // First batch: valid
  await server.write([{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }], {
    dataset: "test_dataset",
    loadBalancer: async () => "node1:8123"
  });

  expect(insertedData.length).toBe(2);

  // Subsequent batch with matching schema: valid
  await server.write([{ id: 3, name: "Charlie" }], {
    dataset: "test_dataset"
  });

  expect(insertedData.length).toBe(3);

  // Subsequent batch with mismatched keys: throws error
  let error: any;
  try {
    await server.write([{ id: 4, missingName: "Dave" }], {
      dataset: "test_dataset"
    });
  } catch (e) {
    error = e;
  }

  expect(error).toBeDefined();
});
