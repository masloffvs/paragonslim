import { expect, test } from "bun:test";
import { EmailType } from "../src/servers/types/emailType";

test("EmailType - toValue", () => {
  const email = new EmailType("TEST@EXAMPLE.COM");
  expect(email.toValue()).toBe("test@example.com");
  
  const email2 = new EmailType("  Test@Example.COM  ");
  expect(email2.toValue()).toBe("test@example.com");
});

test("EmailType - toPretty", () => {
  const email = new EmailType("TEST@EXAMPLE.COM");
  expect(email.toPretty()).toBe("test@example.com");
});

test("EmailType - validate", () => {
  const email = new EmailType("test@example.com");
  expect(email.validate()).toBe(true);
  
  const email2 = new EmailType("invalid-email");
  expect(email2.validate()).toBe("Invalid email format");
  
  const email3 = new EmailType("test@");
  expect(email3.validate()).toBe("Invalid email format");
});

test("EmailType - static from", () => {
  const email = EmailType.from("TEST@EXAMPLE.COM");
  expect(email).toBeInstanceOf(EmailType);
  expect(email.toValue()).toBe("test@example.com");
});

test("EmailType - static normalize", () => {
  expect(EmailType.normalize("TEST@EXAMPLE.COM")).toBe("test@example.com");
  expect(EmailType.normalize("  Test@Example.COM  ")).toBe("test@example.com");
});

test("EmailType - static validateStatic", () => {
  expect(EmailType.validateStatic("test@example.com")).toBe(true);
  expect(EmailType.validateStatic("invalid-email")).toBe("Invalid email format");
});

test("EmailType - handles non-string values", () => {
  const email = new EmailType(123 as any);
  expect(email.toValue()).toBe("");
  
  expect(EmailType.normalize(null)).toBe("");
  expect(EmailType.normalize(undefined)).toBe("");
});
