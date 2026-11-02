import { describe, expect, test } from "vitest";
import type { VolunteersApiV1AttendanceSchemasAttendanceItem as AttendanceItem } from "@/client/types.gen";
import {
  flattenVolunteers,
  getAttendanceSortRank,
} from "@/routes/_logged-in/$yearId/attendance";

function makeItem(overrides: Partial<AttendanceItem> = {}): AttendanceItem {
  return {
    user_day_id: 1,
    day_id: 1,
    day_name: "Day 1",
    user_id: 1,
    user_name: "Alice",
    user_telegram: null,
    position_id: 1,
    position_name: "Operator",
    hall_id: null,
    hall_name: null,
    attendance: "yes",
    assessments: [],
    ...overrides,
  };
}

describe("getAttendanceSortRank", () => {
  test("orders statuses by design rank", () => {
    const ranks = [
      getAttendanceSortRank("yes"),
      getAttendanceSortRank("late"),
      getAttendanceSortRank("sick"),
      getAttendanceSortRank("no"),
      getAttendanceSortRank("unknown"),
    ];
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThan(ranks[i - 1]);
    }
  });

  test("puts a missing record after all statuses", () => {
    expect(getAttendanceSortRank(undefined)).toBeGreaterThan(
      getAttendanceSortRank("unknown"),
    );
  });
});

describe("flattenVolunteers", () => {
  test("merges days of the same user and position into one row", () => {
    const result = flattenVolunteers([
      makeItem({ day_id: 1, attendance: "yes" }),
      makeItem({ day_id: 2, day_name: "Day 2", attendance: "no" }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.attendanceByDay.get(1)?.attendance).toBe("yes");
    expect(result[0]?.attendanceByDay.get(2)?.attendance).toBe("no");
  });

  test("keeps the same user in different positions as separate rows", () => {
    const result = flattenVolunteers([
      makeItem({ position_id: 1, position_name: "Operator" }),
      makeItem({ position_id: 2, position_name: "Coordinator" }),
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((v) => v.position_id).sort()).toEqual([1, 2]);
  });

  test("copies user and position fields to the row", () => {
    const result = flattenVolunteers([
      makeItem({
        user_id: 7,
        user_name: "Bob",
        user_telegram: "bob",
        position_id: 3,
        position_name: "Cook",
        hall_id: 5,
        hall_name: "Main Hall",
      }),
    ]);

    expect(result[0]).toMatchObject({
      user_id: 7,
      user_name: "Bob",
      user_telegram: "bob",
      position_id: 3,
      position_name: "Cook",
      hall_id: 5,
      hall_name: "Main Hall",
    });
  });
});
