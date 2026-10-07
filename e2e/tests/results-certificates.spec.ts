import { readFile } from "node:fs/promises";
import {
  attendanceRow,
  dayCell,
  markAttendance,
  unzipText,
} from "../support/results-certificates";
import { expect, test } from "../support/fixtures";
import { RUN_TAG, users, VOLUNTEERS } from "../support/users";

// From attendance to diplomas: the admin marks attendance and an assessment,
// checks the results, generates certificates and exports the year.
test("attendance -> assessment -> results -> certificates -> export", async ({
  adminPage: page,
  adminApi,
  apiAs,
}, testInfo) => {
  test.setTimeout(120_000);

  // --- Preconditions via API ---
  const yearName = `E2E Results ${RUN_TAG}`;
  const yearId = await adminApi.createYear(yearName);
  await adminApi.editYear(yearId, { open_for_registration: true });

  const hallPosition = await adminApi.createPosition({
    year_id: yearId,
    name: `Hall usher ${RUN_TAG}`,
    has_halls: true,
  });
  const deskPosition = await adminApi.createPosition({
    year_id: yearId,
    name: `Info desk ${RUN_TAG}`,
  });
  const hallId = await adminApi.createHall({
    year_id: yearId,
    name: `Main hall ${RUN_TAG}`,
  });

  const days = [
    { name: `Day 1 ${RUN_TAG}`, mandatory: true },
    { name: `Day 2 ${RUN_TAG}`, mandatory: true },
    { name: `Party ${RUN_TAG}`, mandatory: false },
  ];
  const dayIds: number[] = [];
  for (const day of days) {
    dayIds.push(
      await adminApi.createDay({
        year_id: yearId,
        name: day.name,
        mandatory: day.mandatory,
        assignment_published: true,
      }),
    );
  }
  const [day1, day2, party] = days.map((d) => d.name);

  const placement = {
    vol1: { position_id: hallPosition, hall_id: hallId },
    vol2: { position_id: deskPosition, hall_id: null },
    vol3: { position_id: deskPosition, hall_id: null },
  } as const;
  type Vol = keyof typeof placement;
  const names = {} as Record<Vol, { first: string; last: string }>;
  for (const key of VOLUNTEERS as Vol[]) {
    names[key] = { first: users[key].firstNameEn, last: users[key].lastNameEn };
    const api = await apiAs(key);
    const me = await api.get<{ user_id: number; last_name_en: string }>(
      "/auth/me",
    );
    expect(me.last_name_en).toBe(users[key].lastNameEn);

    await api.apply(yearId, {
      desired_positions_ids: [placement[key].position_id],
      itmo_group: "M3100",
    });
    const formId = await adminApi.formIdOf(yearId, me.user_id);
    for (const dayId of dayIds) {
      await adminApi.assign({
        application_form_id: formId,
        day_id: dayId,
        ...placement[key],
      });
    }
  }

  // Names as the attendance page shows them: "<first en> <last en>"
  const nameOf = (key: Vol) => `${names[key].first} ${names[key].last}`;
  const [alice, boris, vera] = [nameOf("vol1"), nameOf("vol2"), nameOf("vol3")];

  // --- 1. Attendance through the UI ---
  const plan: [string, string, "Yes" | "Late" | "No"][] = [
    [alice, day1, "Yes"],
    [alice, day2, "Yes"],
    [alice, party, "Yes"],
    [boris, day1, "Late"],
    [vera, day1, "No"],
    [vera, day2, "No"],
    [vera, party, "No"],
  ];

  await test.step("admin marks attendance", async () => {
    await page.goto(`/${yearId}/attendance`);
    for (const name of [alice, boris, vera]) {
      await expect(attendanceRow(page, name)).toBeVisible();
    }
    for (const [name, day, label] of plan) {
      await markAttendance(page, name, day, label);
    }
  });

  await test.step("attendance persists after reload", async () => {
    await page.reload();
    await expect(attendanceRow(page, alice)).toBeVisible();
    for (const [name, day, label] of plan) {
      const cell = await dayCell(page, attendanceRow(page, name), day);
      await expect(cell.getByText(label, { exact: true })).toBeVisible();
    }
    // Untouched: Boris on day 2 stays unknown
    const untouched = await dayCell(page, attendanceRow(page, boris), day2);
    await expect(untouched.getByText("Unknown", { exact: true })).toBeVisible();
  });

  // --- 2. Assessment through the UI ---
  const comment = `Great job at the hall ${RUN_TAG}`;
  await test.step("admin adds an assessment", async () => {
    const cell = await dayCell(page, attendanceRow(page, alice), day1);
    await cell.getByRole("button", { name: "Add assessment" }).click();

    const dialog = page.getByRole("dialog", { name: "Add Assessment" });
    await dialog.getByRole("button", { name: "0.5", exact: true }).click();
    await expect(dialog.getByLabel("Score")).toHaveValue("0.5");
    await dialog.getByLabel("Comment").fill(comment);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();

    // The cell now shows the score; the comment is the tooltip of it
    await expect(cell.getByLabel(comment)).toContainText("0.5");
    await page.reload();
    const reloaded = await dayCell(page, attendanceRow(page, alice), day1);
    await expect(reloaded.getByLabel(comment)).toContainText("0.5");
  });

  // --- 3. Results page ---
  await test.step("results show experience of the volunteers", async () => {
    await page.goto(`/${yearId}/results`);
    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    const resultRow = (key: Vol) =>
      page.getByRole("row").filter({ hasText: names[key].last });
    for (const key of ["vol1", "vol2"] as const) {
      const row = resultRow(key);
      await expect(row).toHaveCount(1);
      // Experience and total assessment columns hold numbers
      await expect(row.getByRole("cell").nth(1)).toHaveText(/\d+\.\d\d/);
      await expect(row.getByRole("cell").nth(3)).toHaveText(/\d+\.\d\d/);
    }
    // Results list only volunteers who came (yes/late) at least once,
    // see YearService.get_year_results
    await expect(resultRow("vol3")).toHaveCount(0);

    // The assessment added above is listed for Alice
    const aliceRow = page
      .getByRole("row")
      .filter({ hasText: names.vol1.last });
    await expect(aliceRow.getByText("(1 assessments)")).toBeVisible();
    await aliceRow.getByRole("cell").nth(5).getByRole("button").click();
    const popover = page.getByRole("presentation").filter({ hasText: comment });
    await expect(popover.getByText(comment)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(popover).toBeHidden();
  });

  // --- 4. Certificates ---
  await test.step("certificates are generated", async () => {
    const popupPromise = page.waitForEvent("popup");
    await page.getByRole("button", { name: "Generate Certificates" }).click();
    const popup = await popupPromise;
    await popup.waitForLoadState();

    await expect(popup).toHaveTitle(`Volunteer Certificates - ${yearName}`);
    const holders = popup.locator(".certificate-name");
    // Only volunteers with yes/late on a mandatory day: Alice and Boris
    await expect(holders).toHaveCount(2);
    for (const key of ["vol1", "vol2"] as const) {
      const certificate = holders.filter({ hasText: names[key].last });
      await expect(certificate).toHaveCount(1);
      await expect(certificate).toContainText(names[key].first);
    }
    await expect(
      holders.filter({ hasText: names.vol3.last }),
    ).toHaveCount(0);
    await expect(popup.locator(".certificate-year").first()).toHaveText(
      yearName,
    );

    const html = await popup.content();
    expect(html).toContain(yearName);
    expect(html).not.toContain(names.vol3.last);
    const backgrounds = popup.getByRole("img", {
      name: "Certificate Background",
    });
    await expect(backgrounds).toHaveCount(2);
    await expect(backgrounds.first()).toHaveAttribute(
      "src",
      /^data:image\/svg\+xml;base64,.{100,}/,
    );

    await testInfo.attach("certificates.png", {
      body: await popup.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
    await testInfo.attach("certificates.html", {
      body: html,
      contentType: "text/html",
    });
    await popup.close();
  });

  // --- 5. Export ---
  await test.step("year export downloads CSVs with the volunteers", async () => {
    await page.goto(`/${yearId}/settings`);
    const downloadPromise = page.waitForEvent("download");
    // The key is "Export to ZIP", but its English translation says CSV
    await page.getByRole("button", { name: "Export to CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);

    const zip = await readFile(await download.path());
    expect(zip.length).toBeGreaterThan(0);
    const files = unzipText(zip);
    const usersCsv = [...files.entries()].find(([name]) =>
      name.includes("users"),
    )?.[1];
    expect(usersCsv, `users CSV in ${[...files.keys()]}`).toBeTruthy();
    for (const key of VOLUNTEERS as Vol[]) {
      expect(usersCsv).toContain(names[key].last);
      expect(usersCsv).toContain(names[key].first);
    }
    await testInfo.attach("users.csv", {
      body: usersCsv ?? "",
      contentType: "text/csv",
    });
  });
});
