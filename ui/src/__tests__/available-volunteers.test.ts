import { describe, expect, test } from "vitest";
import type { RegistrationFormItem } from "@/client/types.gen";
import { filterAndSortAvailableVolunteers } from "@/utils/available-volunteers";

function form(
  userId: number,
  firstName: string,
  lastName: string,
  options: {
    englishFirst?: string;
    englishLast?: string;
    patronymic?: string;
    positionIds?: number[];
    previousYearXp?: number;
    createdAt?: string;
  } = {},
): RegistrationFormItem {
  return {
    user_id: userId,
    first_name_ru: firstName,
    last_name_ru: lastName,
    patronymic_ru: options.patronymic ?? null,
    first_name_en: options.englishFirst ?? firstName,
    last_name_en: options.englishLast ?? lastName,
    desired_positions: (options.positionIds ?? []).map((positionId) => ({
      position_id: positionId,
    })),
    previous_year_xp: options.previousYearXp ?? 0,
    created_at: options.createdAt ?? "2026-01-01T00:00:00Z",
  } as RegistrationFormItem;
}

const volunteers = [
  form(1, "Анна", "Соколова", {
    englishFirst: "Anna",
    englishLast: "Sokolova",
    patronymic: "Ивановна",
    positionIds: [10],
    previousYearXp: 2,
    createdAt: "2026-01-02T00:00:00Z",
  }),
  form(2, "Борис", "Миронов", {
    englishFirst: "Boris",
    englishLast: "Mironov",
    positionIds: [20],
    previousYearXp: 8,
    createdAt: "2026-01-01T00:00:00Z",
  }),
  form(3, "Вера", "Орлова", {
    englishFirst: "Vera",
    englishLast: "Orlova",
    positionIds: [10, 20],
    previousYearXp: 0,
    createdAt: "2026-01-03T00:00:00Z",
  }),
];

describe("filterAndSortAvailableVolunteers", () => {
  test("finds Russian and English name parts regardless of case, order, and whitespace", () => {
    for (const search of ["  АННА   Соколова ", "sokolova ANNA", "ивановна"])
      expect(
        filterAndSortAvailableVolunteers(volunteers, {
          search,
          positionId: null,
          sort: "original",
        }).map((item) => item.user_id),
      ).toEqual([1]);
  });

  test("filters by position ID and combines the filter with search", () => {
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "Вера",
        positionId: 20,
        sort: "original",
      }).map((item) => item.user_id),
    ).toEqual([3]);
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "Анна",
        positionId: 20,
        sort: "original",
      }),
    ).toEqual([]);
  });

  test("sorts by previous experience and newest form without mutating input", () => {
    const originalOrder = volunteers.map((item) => item.user_id);
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "",
        positionId: null,
        sort: "experience",
      }).map((item) => item.user_id),
    ).toEqual([2, 1, 3]);
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "",
        positionId: null,
        sort: "newest",
      }).map((item) => item.user_id),
    ).toEqual([3, 1, 2]);
    expect(volunteers.map((item) => item.user_id)).toEqual(originalOrder);
  });

  test("sorts names alphabetically and preserves original order by default", () => {
    const originalOrder = volunteers.map((item) => item.user_id);
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "",
        positionId: null,
        sort: "name",
      }).map((item) => item.user_id),
    ).toEqual([2, 3, 1]);
    expect(
      filterAndSortAvailableVolunteers(volunteers, {
        search: "",
        positionId: null,
        sort: "original",
      }).map((item) => item.user_id),
    ).toEqual(originalOrder);
  });
});
