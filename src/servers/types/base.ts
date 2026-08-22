export abstract class CType<T = any> {
    protected _value: T;

    constructor(value: T) {
        this._value = value;
    }

    abstract toValue(): T;
    abstract toPretty(): string;
    get value(): T {
        return this._value;
    }
    set value(value: T) {
        this._value = value;
    }
    toString(): string {
        return this.toValue() as unknown as string;
    }

    toJSON(): T {
        return this.toValue();
    }
}


export function attachHelpers<T extends typeof CType>(
    constructor: T,
    methods: Partial<Record<keyof InstanceType<T>, Function>>
): void {
    Object.assign(constructor.prototype, methods);
}
