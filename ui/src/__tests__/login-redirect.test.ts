import { describe, expect, test } from "vitest";
import { safeRedirect } from "@/utils/login-redirect";

describe("safeRedirect", () => {
  test("keeps paths of the app with their search", () => {
    expect(safeRedirect("/5/days/12/confirm")).toBe("/5/days/12/confirm");
    expect(safeRedirect("/5/attendance?day=3")).toBe("/5/attendance?day=3");
  });

  test.each([
    undefined,
    null,
    42,
    "",
    "https://evil.example/",
    "//evil.example/",
    "/\\evil.example/",
    "javascript:alert(1)",
    "5/days/12/confirm",
    "/login",
    "/login?redirect=/5",
  ])("falls back to the root for %j", (redirect) => {
    expect(safeRedirect(redirect)).toBe("/");
  });
});
