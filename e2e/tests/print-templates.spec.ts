import { expect, test } from "../support/fixtures";
import { RUN_TAG } from "../support/users";

test("admin creates a template, previews a badge and downloads the print PDF", async ({
  adminPage: page,
  adminApi,
  apiAs,
}) => {
  const yearId = await adminApi.createYear(`E2E Print ${RUN_TAG}`);
  await adminApi.editYear(yearId, { open_for_registration: true });
  const positionId = await adminApi.createPosition({
    year_id: yearId,
    name: "Usher",
  });
  const dayId = await adminApi.createDay({ year_id: yearId, name: "Opening" });
  const volunteer = await apiAs("vol1");
  await volunteer.apply(yearId, { desired_positions_ids: [positionId] });
  await adminApi.assign({
    application_form_id: await adminApi.formIdOf(
      yearId,
      (await volunteer.me()).user_id,
    ),
    day_id: dayId,
    position_id: positionId,
  });

  await page.goto(`/${yearId}/templates`);
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await page.getByRole("textbox", { name: "Template name" }).fill("Volunteer badge");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(
    page.getByRole("heading", { name: "Volunteer badge" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Context settings" }).click();
  await page.getByRole("combobox", { name: "Day", exact: true }).click();
  await page.getByRole("option", { name: "Opening" }).click();
  await expect(page.locator('iframe[title="PDF preview"]')).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  expect((await download).suggestedFilename()).toMatch(/^badges-.+\.pdf$/);
});
