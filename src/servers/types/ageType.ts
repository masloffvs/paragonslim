import { CType } from "./base";
import { type RowValue } from "../dataset";

export class AgeType extends CType<number> {
    constructor(value: number) {
        super(value);
    }

    toValue(): number {
        if (typeof this._value !== "number") return 0;
        return Math.round(this._value);
    }

    toPretty(): string {
        const age = this.toValue();
        return `${age} years`;
    }

    validate(): boolean | string {
        const age = this.toValue();
        if (age < 1) return "Age cannot be less than 1";
        if (age > 120) return "Age cannot be greater than 120";
        return true;
    }

    static from(value: any): AgeType {
        return new AgeType(value);
    }

    static normalize(value: any): number {
        return new AgeType(value).toValue();
    }

    static validateStatic(value: any): boolean | string {
        return new AgeType(value).validate();
    }

    static toDatasetType(nullable: boolean = true): RowValue {
        return {
            type: 'Int64',
            name: "Age",
            nullable: nullable,
            valueProcessor: (value: any) => AgeType.normalize(value),
            // validate: (value: any) => AgeType.validateStatic(value),
        }
    }
}
