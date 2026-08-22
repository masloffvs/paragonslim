import { expect, test } from "bun:test";
import { normalizePhone, validatePhone, PhoneType } from "../src/servers/types/phone";
import { performanceControl } from "./utils/performance";

test("normalizePhone", () => {
  expect(normalizePhone("+7-999-999-9999")).toBe("79999999999");
  expect(normalizePhone("89999999999")).toBe("79999999999");
  expect(normalizePhone("79999999999")).toBe("79999999999");
  expect(normalizePhone("+123456789")).toBe("123456789");
});

test("validatePhone", () => {
  expect(validatePhone("79999999999")).toBe(true);
  expect(validatePhone("123456789")).toBe(true);
  expect(validatePhone("123")).toBe("Invalid phone format");
});

test("PhoneType - toValue", () => {
  const phone = new PhoneType("+7-999-999-9999");
  expect(phone.toValue()).toBe("79999999999");
  
  const phone2 = new PhoneType("89999999999");
  expect(phone2.toValue()).toBe("79999999999");
});

test("PhoneType - toPretty", () => {
  const phone = new PhoneType("79999999999");
  expect(phone.toPretty()).toBe("+7 999 999 9999");
  
  const phone2 = new PhoneType("1234567890");
  expect(phone2.toPretty()).toBe("+1 123 456 7890");
});

test("PhoneType - validate", () => {
  const phone = new PhoneType("79999999999");
  expect(phone.validate()).toBe(true);
  
  const phone2 = new PhoneType("123");
  expect(phone2.validate()).toBe("Invalid phone format");
});

test("PhoneType - static from", () => {
  const phone = PhoneType.from("+7-999-999-9999");
  expect(phone).toBeInstanceOf(PhoneType);
  expect(phone.toValue()).toBe("79999999999");
});

test("PhoneType - static normalize", () => {
  expect(PhoneType.normalize("+7-999-999-9999")).toBe("79999999999");
  expect(PhoneType.normalize("89999999999")).toBe("79999999999");
});

test("PhoneType - static validateStatic", () => {
  expect(PhoneType.validateStatic("79999999999")).toBe(true);
  expect(PhoneType.validateStatic("123")).toBe("Invalid phone format");
});

test("performance", () => {
  const count = 1_000_000;
  const numbers = Array.from({ length: count }, () => "+7-999-999-9999");
  
  performanceControl.million((i) => {
    normalizePhone(numbers[i]);
    validatePhone(numbers[i]);
  });
});
