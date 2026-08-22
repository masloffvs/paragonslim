import { PhoneType } from "./phoneType";

export { PhoneType };

// Re-export functions for backward compatibility
export function normalizePhone(value: any): string {
  return PhoneType.normalize(value);
}

export function validatePhone(value: any): boolean | string {
  return PhoneType.validateStatic(value);
}
