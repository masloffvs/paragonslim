import { expect, test } from "bun:test";
import { AgeType } from "../src/servers/types/ageType";

test("AgeType - toValue", () => {
  const age = new AgeType(30);
  expect(age.toValue()).toBe(30);
  
  const age2 = new AgeType(30.7);
  expect(age2.toValue()).toBe(31);
  
  const age3 = new AgeType(30.2);
  expect(age3.toValue()).toBe(30);
});

test("AgeType - toPretty", () => {
  const age = new AgeType(30);
  expect(age.toPretty()).toBe("30 years");
  
  const age2 = new AgeType(25);
  expect(age2.toPretty()).toBe("25 years");
});

test("AgeType - validate", () => {
  const age = new AgeType(30);
  expect(age.validate()).toBe(true);
  
  const age2 = new AgeType(0);
  expect(age2.validate()).toBe("Age cannot be less than 1");
  
  const age3 = new AgeType(121);
  expect(age3.validate()).toBe("Age cannot be greater than 120");
  
  const age4 = new AgeType(-5);
  expect(age4.validate()).toBe("Age cannot be less than 1");
});

test("AgeType - static from", () => {
  const age = AgeType.from(30);
  expect(age).toBeInstanceOf(AgeType);
  expect(age.toValue()).toBe(30);
});

test("AgeType - static normalize", () => {
  expect(AgeType.normalize(30)).toBe(30);
  expect(AgeType.normalize(30.7)).toBe(31);
  expect(AgeType.normalize(30.2)).toBe(30);
});

test("AgeType - static validateStatic", () => {
  expect(AgeType.validateStatic(30)).toBe(true);
  expect(AgeType.validateStatic(0)).toBe("Age cannot be less than 1");
  expect(AgeType.validateStatic(121)).toBe("Age cannot be greater than 120");
});

test("AgeType - handles non-number values", () => {
  const age = new AgeType("30" as any);
  expect(age.toValue()).toBe(0);
  
  expect(AgeType.normalize(null)).toBe(0);
  expect(AgeType.normalize(undefined)).toBe(0);
  expect(AgeType.normalize("invalid" as any)).toBe(0);
});
