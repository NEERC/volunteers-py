import { describe, expect, test } from "vitest";
import { updateExcludedFormIds } from "@/components/mailing/recipientSelection";

describe("updateExcludedFormIds", () => {
  test("selects all current recipients and preserves hidden exclusions", () => {
    expect(updateExcludedFormIds([1, 99], [1, 2, 3], false)).toEqual([99]);
  });

  test("clears selection for all current recipients only", () => {
    expect(updateExcludedFormIds([], [1, 2], true)).toEqual([1, 2]);
    expect(updateExcludedFormIds([99], [1, 2], true)).toEqual([99, 1, 2]);
  });

  test("does not change exclusions for an empty recipient list", () => {
    expect(updateExcludedFormIds([99], [], false)).toEqual([99]);
    expect(updateExcludedFormIds([99], [], true)).toEqual([99]);
  });
});
