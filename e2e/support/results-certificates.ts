import { inflateRawSync } from "node:zlib";
import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Minimal ZIP reader (stored/deflated entries, no ZIP64), enough for the year
 * export archive. Returns file name -> content as UTF-8 text.
 */
export function unzipText(zip: Buffer): Map<string, string> {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new Error("Not a ZIP archive: no end of central directory");
  }
  const entries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);
  const files = new Map<string, string>();
  for (let n = 0; n < entries; n++) {
    const method = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localOffset = zip.readUInt32LE(offset + 42);
    const name = zip.toString("utf8", offset + 46, offset + 46 + nameLength);

    const dataStart =
      localOffset +
      30 +
      zip.readUInt16LE(localOffset + 26) +
      zip.readUInt16LE(localOffset + 28);
    const data = zip.subarray(dataStart, dataStart + compressedSize);
    const content =
      method === 0 ? data : method === 8 ? inflateRawSync(data) : null;
    if (!content) {
      throw new Error(`Unsupported compression ${method} of ${name}`);
    }
    files.set(name, content.toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

/** Attendance page: the table row of a volunteer (by a unique part of the name). */
export function attendanceRow(page: Page, name: string): Locator {
  return page.getByRole("row").filter({ hasText: name });
}

/**
 * Attendance page in the "All Days" view: the cell of the day column.
 * Columns are Position, Hall, Name, then the days in the order of the header.
 */
export async function dayCell(
  page: Page,
  row: Locator,
  dayName: string,
): Promise<Locator> {
  // The table renders after the attendance query, wait for it
  await expect(
    page.getByRole("columnheader", { name: dayName, exact: true }),
  ).toBeVisible();
  const headers = await page
    .getByRole("columnheader")
    .allTextContents()
    .then((texts) => texts.map((t) => t.trim()));
  const index = headers.indexOf(dayName);
  if (index < 0) {
    throw new Error(`No column "${dayName}" among ${headers.join(", ")}`);
  }
  return row.getByRole("cell").nth(index);
}

/**
 * Sets attendance of a volunteer on a day: picks the value in the toolbar
 * selector and clicks the day cell, then waits for the cell to show it.
 */
export async function markAttendance(
  page: Page,
  name: string,
  dayName: string,
  label: "Yes" | "No" | "Late" | "Sick" | "Unknown",
) {
  const selector = page.getByRole("group").getByRole("button", {
    name: label,
    exact: true,
  });
  await selector.click();
  await expect(selector).toHaveAttribute("aria-pressed", "true");

  const cell = await dayCell(page, attendanceRow(page, name), dayName);
  // The clickable status is the first line of the cell: icon + label
  await cell.getByText(/^(Yes|No|Late|Sick|Unknown)$/).click();
  await expect(cell.getByText(label, { exact: true })).toBeVisible();
}
