import { CType } from "./base";
import { type RowValue } from "../dataset";

export class PhoneType extends CType<string> {
    constructor(value: string) {
        super(value);
    }

    toValue(): string {
        if (typeof this._value !== "string") return "";
        let cleaned = this._value.replace(/[\s\-\(\)\.\+]/g, "");

        if (cleaned.startsWith("8")) {
            cleaned = "7" + cleaned.substring(1);
        }

        return cleaned;
    }

    toPretty(): string {
        const normalized = this.toValue();
        
        if (normalized.startsWith("7") && normalized.length === 11) {
            return `+7 ${normalized.slice(1, 4)} ${normalized.slice(4, 7)} ${normalized.slice(7)}`;
        }
        
        if (normalized.length === 10) {
            return `+1 ${normalized.slice(0, 3)} ${normalized.slice(3, 6)} ${normalized.slice(6)}`;
        }
        
        return `+${normalized}`;
    }

    validate(): boolean | string {
        const normalized = this.toValue();

        if (normalized.startsWith("7")) {
            return /^\d{11}$/.test(normalized) || "Invalid RU/KZ number format";
        }

        return /^\d{7,15}$/.test(normalized) || "Invalid phone format";
    }

    static from(value: any): PhoneType {
        return new PhoneType(value);
    }

    static normalize(value: any): string {
        return new PhoneType(value).toValue();
    }

    static validateStatic(value: any): boolean | string {
        return new PhoneType(value).validate();
    }

    static toDatasetType(nullable: boolean = true): RowValue {
        return {
            type: 'String',
            name: "Phone number",
            nullable: nullable,
            valueProcessor: (value: any) => PhoneType.normalize(value),
            validate: (value: any) => PhoneType.validateStatic(value),
        }
    }
}
