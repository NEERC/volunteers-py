import { describe, expect, test } from "vitest";
import {
  duplicateKey,
  findSuspectedDuplicates,
  normalizeName,
} from "@/utils/duplicates";

const user = (
  user_id: number,
  last_name_ru: string,
  first_name_ru: string,
) => ({
  user_id,
  last_name_ru,
  first_name_ru,
});

describe("normalizeName", () => {
  test("ignores case, ё, spaces and punctuation", () => {
    expect(normalizeName(" Фёдоров-Петров ")).toBe("федоровпетров");
  });
});

describe("duplicateKey", () => {
  test("is null for users without a name", () => {
    expect(duplicateKey(user(1, " ", ""))).toBeNull();
  });
});

describe("findSuspectedDuplicates", () => {
  test("returns users sharing normalized last and first names, grouped", () => {
    const users = [
      user(5, "Петров", "Пётр"),
      user(1, "Иванов", "Иван"),
      user(2, "Сидоров", "Иван"),
      user(3, "петров ", "петр"),
      user(4, "ИВАНОВ", "Иван"),
      user(6, "", ""),
      user(7, "", ""),
    ];
    expect(findSuspectedDuplicates(users).map((u) => u.user_id)).toEqual([
      1, 4, 3, 5,
    ]);
  });
});
