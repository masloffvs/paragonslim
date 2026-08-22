import { CType } from "./base";
import { type RowValue } from "../dataset";

export class EmailType extends CType<string> {
    constructor(value: string) {
        super(value);
    }

    toValue(): string {
        if (typeof this._value !== "string") return "";
        return this._value.toLowerCase().trim();
    }

    toPretty(): string {
        return this.toValue();
    }

    validate(): boolean | string {
        const normalized = this.toValue();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(normalized) || "Invalid email format";
    }

    static from(value: any): EmailType {
        return new EmailType(value);
    }

    static normalize(value: any): string {
        return new EmailType(value).toValue();
    }

    static validateStatic(value: any): boolean | string {
        return new EmailType(value).validate();
    }

    static toDatasetType(nullable: boolean = true): RowValue {
            return {
                type: 'String',
                name: "Email",
                nullable: nullable,
                valueProcessor: (value: any) => EmailType.normalize(value),
                 // validate: (value: any) => EmailType.validateStatic(value),
            }
        }
}
