import { Transformer } from "./transformer";
import { collapseKey, getDefaultFieldMapping } from "../utils/keyUtils";
import { normalizeValue } from "../utils/normalizationUtils";
import { mapKeys, mapValues } from "lodash-es";
import { isObject } from "../utils/assert";

export class BasicDeenthropyTransformer extends Transformer {
    private fieldMapping = getDefaultFieldMapping();

    constructor() {
        super();
    }

    public transform(row: any): any {
        if (!isObject(row)) {
            return row;
        }

        const collapsedKeys = mapKeys(row, (value: any, key: string) => {
            return collapseKey(key, this.fieldMapping);
        });

        return mapValues(collapsedKeys, (value: any, key: string) => {
            return normalizeValue(key, value);
        });
    }
}
