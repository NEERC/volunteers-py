import { expect, test } from "@playwright/test";

// Exercise the real page and browser APIs with deterministic attendance data.
// API requests are mocked so this test does not modify a database.
test.use({ locale: "en-US", video: "off", trace: "off" });

test("copies and downloads the selected attendance columns", async ({
  page,
  context,
}) => {
  const yearId = 42;
  const days = [
    { day_id: 1, day_name: "First day" },
    { day_id: 2, day_name: "Second day" },
  ];
  const base = {
    user_id: 1,
    user_name: "Alice Иванова",
    user_telegram: "alice",
    position_id: 1,
    position_name: "Information desk",
    hall_id: 1,
    hall_name: "Main hall",
    assessments: [],
  };
  const attendance = [
    { ...base, ...days[0], user_day_id: 1, attendance: "yes" },
    {
      ...base,
      ...days[1],
      user_day_id: 2,
      hall_id: 2,
      hall_name: "Side hall",
      attendance: "late",
      assessments: [
        { assessment_id: 1, value: 0.5, comment: "Good", author: null },
        { assessment_id: 2, value: 1, comment: "Great", author: null },
      ],
    },
  ];

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    localStorage.setItem("AuthStore", JSON.stringify({ refreshToken: "test" }));
    localStorage.setItem("i18nextLng", "en");

  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace(/\/$/, "");
    let body: unknown;
    if (path === "/api/v1/auth/refresh") {
      body = { success: true, token: "test", refresh_token: "test" };
    } else if (path === "/api/v1/auth/me") {
      body = { user_id: 1, is_admin: true };
    } else if (path === "/api/v1/year") {
      body = { years: [{ year_id: yearId, year_name: "Test year" }] };
    } else if (path === `/api/v1/year/${yearId}`) {
      body = { days: days.map(({ day_id, day_name }) => ({ day_id, name: day_name })) };
    } else if (path === `/api/v1/attendance/${yearId}/all`) {
      body = { attendance };
    } else {
      throw new Error(`Unexpected API request: ${path}`);
    }
    await route.fulfill({ json: body });
  });

  await page.goto(`/${yearId}/attendance`);
  const volunteerRow = page.getByRole("row", { name: /Alice Иванова/ });
  await expect(volunteerRow).toBeVisible();
  await expect(volunteerRow.getByRole("cell").nth(1)).toHaveText(
    "Main hall, Side hall",
  );
  const readClipboard = () =>
    page.evaluate(async () => (await navigator.clipboard.readText()).replace(/\r\n/g, "\n"));
  const expectedAllDays =
    "Position\tHall\tName\tFirst day\tSecond day\n" +
    "Information desk\tMain hall, Side hall\tAlice Иванова (@alice)\tYes\tLate (0.75)";
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect.poll(readClipboard).toBe(expectedAllDays);

  await page.getByRole("tab", { name: "Second day" }).click();
  await expect(page.getByRole("columnheader", { name: "First day" })).toHaveCount(0);
  await expect(volunteerRow.getByRole("cell").nth(1)).toHaveText("Side hall");
  const expectedSelectedDay =
    "Position\tHall\tName\tSecond day\n" +
    "Information desk\tSide hall\tAlice Иванова (@alice)\tLate (0.75)";
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect.poll(readClipboard).toBe(expectedSelectedDay);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`attendance-${yearId}.tsv`);
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const bytes = Buffer.concat(chunks);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  expect(new TextDecoder().decode(bytes)).toBe(expectedSelectedDay);
});
