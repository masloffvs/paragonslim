import { Transformer } from "./transformer";
import { collapseKey, getDefaultFieldMapping } from "../utils/keyUtils";
import { normalizeValue } from "../utils/normalizationUtils";
import { mapKeys, mapValues } from "lodash-es";
import { isObject } from "../utils/assert";
/**
 * Basic deenthropy transformer that normalizes and collapses keys
 * Input:
 *  {
 *    "first_name": "John",
 *    "last_name": "Doe",
 *    "phone": "+1234567890",
 *    "email": " john.doe@example.com"
 *  }
 * Output:
 * {
 *    "firstName": "John",
 *    "lastName": "Doe",
 *    "phone": "1234567890",
 *    "email": "john.doe@example.com"
 *  }
 */
export class BasicDeenthropyTransformer extends Transformer {
  private fieldMapping = getDefaultFieldMapping();

  constructor() {
    super();
  }

  public transform<T>(row: T): T {
    if (!isObject(row)) {
      return row;
    }

    const rowAsRecord = row as Record<string, unknown>;

    const collapsedKeys = mapKeys(
      rowAsRecord,
      (_value: unknown, key: string) => {
        return collapseKey(key, this.fieldMapping);
      },
    );

    return mapValues(collapsedKeys, (_value: unknown, key: string) => {
      return normalizeValue(key, _value);
    }) as T;
  }
}
