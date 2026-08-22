import { Source } from "./source";

export class ArrayOfRowsSource extends Source {
    private schema: Map<string, string> | null = null;
    private data: any[];

    constructor(rows: any[]) {
        super("");
        
        if (!Array.isArray(rows)) {
            throw new Error("ArrayOfRowsSource expects an array of objects");
        }
        
        if (rows.length === 0) {
            throw new Error("ArrayOfRowsSource cannot be empty");
        }
        
        this.data = rows;
        this.schema = this.validateSchemaEfficiently(rows);
    }

    private validateSchemaEfficiently(rows: any[]): Map<string, string> {
        const firstRow = rows[0];
        
        if (typeof firstRow !== 'object' || firstRow === null || Array.isArray(firstRow)) {
            throw new Error("ArrayOfRowsSource expects array of objects, not arrays or primitives");
        }
        
        const schema = new Map<string, string>();
        const firstKeys = Object.keys(firstRow);
        
        for (const key of firstKeys) {
            const value = firstRow[key];
            schema.set(key, this.getValueType(value));
        }
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            
            if (typeof row !== 'object' || row === null || Array.isArray(row)) {
                throw new Error(`Row ${i} is not an object`);
            }
            
            const keys = Object.keys(row);
            
            if (keys.length !== firstKeys.length) {
                throw new Error(`Row ${i} has different number of keys than first row`);
            }
            
            for (const key of firstKeys) {
                if (!keys.includes(key)) {
                    throw new Error(`Row ${i} is missing key '${key}'`);
                }
            }
            
            for (const key of firstKeys) {
                const expectedType = schema.get(key);
                const actualValue = row[key];
                const actualType = this.getValueType(actualValue);
                
                if (actualValue === null || actualValue === undefined) {
                    continue;
                }
                
                if (actualType !== expectedType) {
                    throw new Error(
                        `Row ${i}, key '${key}': type mismatch. Expected '${expectedType}', got '${actualType}'`
                    );
                }
            }
        }
        
        return schema;
    }

    private getValueType(value: any): string {
        if (value === null) return 'null';
        if (value === undefined) return 'undefined';
        
        const type = typeof value;
        
        if (type === 'number') {
            return Number.isInteger(value) ? 'integer' : 'float';
        }
        
        if (type === 'object') {
            if (Array.isArray(value)) return 'array';
            if (value instanceof Date) return 'date';
            return 'object';
        }
        
        return type;
    }

    public override async execute<T, R extends any[]>(prevResults: R): Promise<T | null | undefined> {
        return this.data as T | null | undefined;
    }
}
