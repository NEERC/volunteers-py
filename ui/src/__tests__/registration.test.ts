import { describe, expect, test } from "vitest";
import {
  requiredLabel,
  shouldDisplayFieldError,
} from "@/routes/_logged-in/$yearId/registration";

describe("requiredLabel", () => {
  test("appends an asterisk to label", () => {
    expect(requiredLabel("Email")).toBe("Email *");
  });
});

describe("shouldDisplayFieldError", () => {
  test("hides errors when field untouched", () => {
    expect(shouldDisplayFieldError("Required", false)).toBe(false);
    expect(shouldDisplayFieldError("Required", undefined)).toBe(false);
  });

  test("hides errors when no error value", () => {
    expect(shouldDisplayFieldError(undefined, true)).toBe(false);
    expect(shouldDisplayFieldError(null, true)).toBe(false);
  });

  test("shows errors only when both error and touched", () => {
    expect(shouldDisplayFieldError("Required", true)).toBe(true);
  });
});
