import type { VolunteersApiV1AttendanceSchemasAttendanceItem as AttendanceItem } from "@/client/types.gen";
import { getAttendanceLabel } from "@/components/AttendanceSelector";

export interface VolunteerAttendance {
  user_id: number;
  user_name: string;
  user_telegram: string | null;
  position_id: number;
  position_name: string;
  attendanceByDay: Map<number, AttendanceItem>;
}

export function groupAttendance(items: AttendanceItem[]) {
  const groups = new Map<number, Map<number, VolunteerAttendance>>();
  for (const item of items) {
    if (!groups.has(item.position_id)) groups.set(item.position_id, new Map());
    const volunteers = groups.get(item.position_id);
    if (!volunteers) continue;
    if (!volunteers.has(item.user_id)) {
      volunteers.set(item.user_id, {
        user_id: item.user_id,
        user_name: item.user_name,
        user_telegram: item.user_telegram,
        position_id: item.position_id,
        position_name: item.position_name,
        attendanceByDay: new Map(),
      });
    }
    volunteers.get(item.user_id)?.attendanceByDay.set(item.day_id, item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, volunteers]) => [...volunteers.values()]);
}

function escapeCell(value: string): string {
  return /[\t\r\n"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

// Spreadsheet programs may interpret user-provided cell contents as formulas.
function spreadsheetText(value: string): string {
  return value !== "-" && /^\s*[=+\-@]/.test(value) ? `'${value}` : value;
}

export function getDisplayedHalls(
  volunteer: VolunteerAttendance,
  days: Array<{ day_id: number }>,
): string {
  const halls = new Set<string>();
  for (const day of days) {
    const item = volunteer.attendanceByDay.get(day.day_id);
    if (item) halls.add(item.hall_name || "-");
  }
  return [...halls].join(", ") || "-";
}

export function buildAttendanceTsv(
  volunteers: VolunteerAttendance[],
  days: Array<{ day_id: number; day_name: string }>,
  t: (key: string) => string,
): string {
  const rows = volunteers.map((volunteer) => [
    spreadsheetText(volunteer.position_name),
    spreadsheetText(getDisplayedHalls(volunteer, days)),
    spreadsheetText(
      volunteer.user_telegram
        ? `${volunteer.user_name} (@${volunteer.user_telegram})`
        : volunteer.user_name,
    ),
    ...days.map((day) => {
      const item = volunteer.attendanceByDay.get(day.day_id);
      if (!item) return "-";
      const label = getAttendanceLabel(item.attendance, t);
      if (!item.assessments.length) return label;
      const average =
        item.assessments.reduce((sum, a) => sum + a.value, 0) /
        item.assessments.length;
      return `${label} (${Number(average.toFixed(2))})`;
    }),
  ]);
  return [
    [
      t("Position"),
      t("Hall"),
      t("Name"),
      ...days.map((day) => spreadsheetText(day.day_name)),
    ],
    ...rows,
  ]
    .map((row) => row.map(escapeCell).join("\t"))
    .join("\n");
}
