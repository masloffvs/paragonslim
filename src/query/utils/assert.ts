/**
 * Assert utility functions for runtime validation
 */

/**
 * Checks if a value is a valid object (not null, not array, is object type)
 */
export function isObject(value: any): value is Record<string, any> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Asserts that a value is a valid object, returns the value if true, otherwise returns fallback
 */
export function assertObject<T>(value: T, fallback?: T): T {
    if (isObject(value)) {
        return value;
    }
    return fallback ?? value;
}

/**
 * Checks if a value is null or undefined
 */
export function isNil(value: any): value is null | undefined {
    return value === null || value === undefined;
}

/**
 * Asserts that a value is not null or undefined, returns fallback if nil
 */
export function assertNotNil<T>(value: T, fallback: T): T {
    return isNil(value) ? fallback : value;
}

/**
 * Checks if a value is a string
 */
export function isString(value: any): value is string {
    return typeof value === 'string';
}

/**
 * Checks if a value is a number
 */
export function isNumber(value: any): value is number {
    return typeof value === 'number' && !isNaN(value);
}

/**
 * Checks if a value is a boolean
 */
export function isBoolean(value: any): value is boolean {
    return typeof value === 'boolean';
}

/**
 * Checks if a value is an array
 */
export function isArray(value: any): value is any[] {
    return Array.isArray(value);
}

/**
 * Checks if a value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: any): boolean {
    if (isNil(value)) return true;
    if (isString(value)) return value.length === 0;
    if (isArray(value)) return value.length === 0;
    if (isObject(value)) return Object.keys(value).length === 0;
    return false;
}
