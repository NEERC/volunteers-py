import { describe, expect, it } from "vitest";
import type { VolunteersApiV1AttendanceSchemasAttendanceItem as AttendanceItem } from "@/client/types.gen";
import { buildAttendanceTsv } from "@/utils/attendance-export";

const days = [
  { day_id: 1, day_name: "Day 1" },
  { day_id: 2, day_name: "Day 2" },
];
const t = (key: string) => key;

function item(overrides: Partial<AttendanceItem> = {}): AttendanceItem {
  return {
    user_day_id: 1,
    day_id: 1,
    day_name: "Day 1",
    user_id: 1,
    user_name: "Alice",
    user_telegram: "alice",
    position_id: 1,
    position_name: "Helper",
    hall_id: 1,
    hall_name: "Main",
    attendance: "yes",
    assessments: [],
    ...overrides,
  };
}

describe("buildAttendanceTsv", () => {
  it("exports the displayed days, grouping assignments by position and volunteer", () => {
    const items = [
      item({ day_id: 2, day_name: "Day 2", attendance: "late" }),
      item({
        assessments: [
          { assessment_id: 1, value: 0.5, comment: "Good", author: null },
          { assessment_id: 2, value: 1, comment: "Great", author: null },
        ],
      }),
      item({
        user_id: 2,
        user_name: "Bob",
        user_telegram: null,
        hall_id: null,
        hall_name: null,
        attendance: "unknown",
      }),
    ];

    expect(buildAttendanceTsv(items, days, t)).toBe(
      "Position\tHall\tName\tDay 1\tDay 2\n" +
        "Helper\tMain\tAlice (@alice)\tYes (0.75)\tLate\n" +
        "Helper\t-\tBob\tUnknown\t-",
    );
    expect(buildAttendanceTsv(items, [days[1]], t)).toBe(
      "Position\tHall\tName\tDay 2\n" +
        "Helper\tMain\tAlice (@alice)\tLate\n" +
        "Helper\t-\tBob\t-",
    );
  });

  it("quotes tabs, quotes and line breaks so each value remains one cell", () => {
    const special = item({
      position_name: 'Front\t"desk"',
      user_name: "Alice\nSmith",
      user_telegram: null,
    });
    expect(buildAttendanceTsv([special], [days[0]], t)).toBe(
      'Position\tHall\tName\tDay 1\n"Front\t""desk"""\tMain\t"Alice\nSmith"\tYes',
    );
  });

  it("exports the halls for the displayed days rather than the first assignment", () => {
    const items = [
      item({ day_id: 1, hall_name: "Main" }),
      item({ day_id: 2, day_name: "Day 2", hall_id: 2, hall_name: "Side" }),
    ];

    expect(buildAttendanceTsv(items, days, t)).toContain("\tMain, Side\t");
    expect(buildAttendanceTsv(items, [days[1]], t)).toContain("\tSide\t");
    expect(
      buildAttendanceTsv(items, [{ day_id: 3, day_name: "Day 3" }], t),
    ).toContain("\t-\t");
  });

  it("treats formula-like names and headers as text in spreadsheets", () => {
    const special = item({
      position_name: '=HYPERLINK("https://example.com")',
      hall_name: "  +Hall",
      user_name: "@Alice\tSmith",
      user_telegram: null,
    });
    expect(
      buildAttendanceTsv([special], [{ day_id: 1, day_name: "-Day 1" }], t),
    ).toBe(
      `Position\tHall\tName\t'-Day 1\n` +
        `"'=HYPERLINK(""https://example.com"")"\t'  +Hall\t"'@Alice\tSmith"\tYes`,
    );
  });

  it("uses translated labels and emits headers for an empty result", () => {
    const translations: Record<string, string> = {
      Position: "Роль",
      Hall: "Холл",
      Name: "Имя",
      Yes: "Да",
    };
    const translate = (key: string) => translations[key] ?? key;
    expect(buildAttendanceTsv([], days, translate)).toBe(
      "Роль\tХолл\tИмя\tDay 1\tDay 2",
    );
    expect(buildAttendanceTsv([item()], [days[0]], translate)).toContain(
      "\tДа",
    );
  });
});
