
import $logger from "../pino";
import { collapseKey, getDefaultFieldMapping } from "../query/utils/keyUtils";

function checkVersion(version: string): void {
  const regex = /^\d{3}$/;
  if (!regex.test(version)) {
    throw new Error(
      `Version must be a 3-digit string (001-999), got: ${version}`,
    );
  }
  const num = parseInt(version, 10);
  if (num < 1 || num > 999) {
    throw new Error(`Version must be between 001 and 999, got: ${version}`);
  }
}


let globalCounter = 1;

export class Dataset {
  public define: DefineDataset;
  constructor(define: DefineDataset) {
    checkVersion(define.version);
    this.define = define;
    $logger.debug(`Creating dataset ${define.name} version ${define.version}`);
  }
}

type RowValueType =
  "String" | "Int64" | "Float64" | "DateTime" | "Boolean" | "UUID";
export interface RowValue {
  type: RowValueType;
  name?: string;
  defaultValue?: any;
  nullable?: boolean;
  valueProcessor?: (value: any) => any;
  validate?: (value: any) => boolean | string;
}

type MergeTreeEngine =
  | "MergeTree"
  | "ReplacingMergeTree"
  | "SummingMergeTree"
  | "AggregatingMergeTree"
  | "CollapsingMergeTree"
  | "VersionedCollapsingMergeTree"
  | "GraphiteMergeTree"
  | "CoalescingMergeTree";
type LogEngine = "TinyLog" | "StripeLog" | "Log";
type SpecialEngine =
  | "Memory"
  | "File"
  | "Null"
  | "Set"
  | "Join"
  | "URL"
  | "View"
  | "Distributed"
  | "Dictionary"
  | "Merge"
  | "Executable"
  | "Buffer"
  | "GenerateRandom"
  | "KeeperMap"
  | "FileLog"
  | "Alias";

type TableEngine = MergeTreeEngine | LogEngine | SpecialEngine;

interface ClickHouseConfig {
  database?: string;
  engine?: TableEngine;
  orderBy?: string[];
  partitionBy?: string;
  primaryKey?: string[];
  uniqKeys?: string[];
  settings?: Record<string, any>;
}

interface DefineDataset {
  name: string;
  version: string;
  primaryKey?: string | string[];
  row?: Record<string, RowValue>;
  clickhouse?: ClickHouseConfig;
}

export const UUID_SYSTEM = {
  get id(): string {
    const uuidPart = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
    const counterPart = String(globalCounter++).padStart(10, "0");
    return `${uuidPart}-${counterPart}`;
  },
} as const;

export function defineDataset(define: DefineDataset) {
  const fieldMapping = getDefaultFieldMapping();
  const collapsedKeys = new Map<string, string>();
  const autoAddedKeys = new Set<string>();

  const primaryKeys = define.primaryKey
    ? Array.isArray(define.primaryKey)
      ? define.primaryKey
      : [define.primaryKey]
    : define.clickhouse?.primaryKey || [];

  if (!define.row) {
    define.row = {};
  }
  if (!define.row.id) {
    // Если есть primaryKey в clickhouse настройках, используем String для shard key
    const hasPrimaryKey = define.clickhouse?.primaryKey && define.clickhouse.primaryKey.length > 0;
    define.row.id = { 
      type: hasPrimaryKey ? "String" : "UUID", 
      nullable: false 
    };
    autoAddedKeys.add("id");
  }

  for (const pk of primaryKeys) {
    if (define.row) {
      let found = false;
      const collapsedPk = collapseKey(pk, fieldMapping);
      for (const key of Object.keys(define.row)) {
        if (autoAddedKeys.has(key)) continue;
        if (key === pk || collapseKey(key, fieldMapping) === collapsedPk) {
          found = true;
          break;
        }
      }
      if (!found) {
        throw new Error(`Primary key '${pk}' is not defined in dataset rows.`);
      }
    }
  }

  for (const [key, r] of Object.entries(define.row || {})) {
    if (!r.type) {
      throw new Error(`Row value must have a type`);
    }

    const collapsedKey = collapseKey(key, fieldMapping);

    if (collapsedKeys.has(collapsedKey)) {
      const originalKey = collapsedKeys.get(collapsedKey);
      if (autoAddedKeys.has(key) || autoAddedKeys.has(originalKey)) {
        // allow auto-added id to coexist with user-defined keys
      } else {
        throw new Error(
          `Key '${key}' conflicts with '${originalKey}' - both collapse to '${collapsedKey}'. Use only one canonical form.`,
        );
      }
    }

    collapsedKeys.set(collapsedKey, key);
  }

  return new Dataset(define);
}
