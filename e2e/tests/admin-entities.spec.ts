import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../support/fixtures";
import { RUN_TAG } from "../support/users";

// Admin creates a year and all its entities (positions, halls, days) through
// the settings UI, edits them, and a volunteer sees the opened year.

const yearName = `Smoke Year ${RUN_TAG}`;
const yearRenamed = `Smoke Year ${RUN_TAG} renamed`;

const positions = {
  regular: {
    name: `Greeter ${RUN_TAG}`,
    description: "Meets guests at the entrance",
    score: "1.5",
  },
  halls: {
    name: `Hall Keeper ${RUN_TAG}`,
    description: "Keeps order in a hall",
    score: "2",
  },
  manager: {
    name: `Manager ${RUN_TAG}`,
    description: "Manages volunteers",
    score: "3",
  },
};
const regularRenamed = `Greeter ${RUN_TAG} edited`;
const regularDescriptionEdited = "Meets guests at the main entrance";

const halls = {
  a: { name: `Hall A ${RUN_TAG}`, description: "Main hall" },
  b: { name: `Hall B ${RUN_TAG}`, description: "Small hall" },
};
const hallBDescriptionEdited = "Small hall on the 2nd floor";

const days = {
  mandatory: {
    name: `Day 1 ${RUN_TAG}`,
    information: "Opening ceremony",
    score: "2",
  },
  optional: {
    name: `Day 2 ${RUN_TAG}`,
    information: "Workshops",
    score: "1",
  },
};
const optionalDayRenamed = `Day 2 ${RUN_TAG} edited`;
const optionalDayInformationEdited = "Workshops and closing";

/** A section (Paper) of the settings page by its heading. */
function section(page: Page, heading: string): Locator {
  return page
    .locator(".MuiPaper-root")
    .filter({ has: page.getByRole("heading", { name: heading, exact: true }) });
}

/** A list item of a settings section that contains the text. */
function item(page: Page, heading: string, name: string): Locator {
  return section(page, heading)
    .getByRole("listitem")
    .filter({ hasText: name });
}

async function addPosition(
  page: Page,
  data: { name: string; description: string; score: string },
  flags: { canDesire?: boolean; hasHalls?: boolean; isManager?: boolean },
) {
  await section(page, "Positions")
    .getByRole("button", { name: "Add Position" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add New Position" });
  await dialog.getByLabel("Position Name").fill(data.name);
  await dialog.getByLabel("Description").fill(data.description);
  await dialog.getByRole("spinbutton", { name: "Score" }).fill(data.score);
  await dialog
    .getByLabel("Available for registration")
    .setChecked(!!flags.canDesire);
  await dialog.getByLabel("Has halls").setChecked(!!flags.hasHalls);
  await dialog.getByLabel("Is manager").setChecked(!!flags.isManager);
  await dialog.getByRole("button", { name: "Add Position" }).click();
  await expect(dialog).toBeHidden();
  await expect(item(page, "Positions", data.name)).toBeVisible();
}

async function addHall(
  page: Page,
  data: { name: string; description: string },
) {
  await section(page, "Halls").getByRole("button", { name: "Add Hall" }).click();
  const dialog = page.getByRole("dialog", { name: "Add New Hall" });
  await dialog.getByLabel("Hall Name").fill(data.name);
  await dialog.getByLabel("Description").fill(data.description);
  await dialog.getByRole("button", { name: "Add Hall" }).click();
  await expect(dialog).toBeHidden();
  await expect(item(page, "Halls", data.name)).toBeVisible();
}

async function addDay(
  page: Page,
  data: { name: string; information: string; score: string },
  mandatory: boolean,
) {
  await section(page, "Days").getByRole("button", { name: "Add Day" }).click();
  const dialog = page.getByRole("dialog", { name: "Add New Day" });
  await dialog.getByLabel("Day Name").fill(data.name);
  await dialog.getByLabel("Information").fill(data.information);
  await dialog.getByRole("spinbutton", { name: "Score" }).fill(data.score);
  await dialog.getByLabel("Mandatory day").setChecked(mandatory);
  await dialog.getByRole("button", { name: "Add Day" }).click();
  await expect(dialog).toBeHidden();
  await expect(item(page, "Days", data.name)).toBeVisible();
}

/** Checks that all entities created by the admin are listed on settings. */
async function expectCreatedEntities(page: Page) {
  const regular = item(page, "Positions", positions.regular.name);
  await expect(regular).toContainText(positions.regular.description);
  await expect(regular).toContainText("Score:");
  await expect(regular.getByLabel("Available for registration")).toBeVisible();

  const hallsPosition = item(page, "Positions", positions.halls.name);
  await expect(hallsPosition).toContainText(positions.halls.description);
  await expect(hallsPosition.getByLabel("Has halls")).toBeVisible();

  const manager = item(page, "Positions", positions.manager.name);
  await expect(manager).toContainText(positions.manager.description);
  await expect(manager.getByLabel("Is manager")).toBeVisible();
  await expect(manager.getByLabel("Hidden from registration")).toBeVisible();

  for (const hall of Object.values(halls)) {
    await expect(item(page, "Halls", hall.name)).toContainText(
      hall.description,
    );
  }

  const mandatory = item(page, "Days", days.mandatory.name);
  await expect(mandatory).toContainText(days.mandatory.information);
  await expect(mandatory).toContainText("Score:");
  await expect(mandatory.getByLabel("Mandatory day")).toBeVisible();

  const optional = item(page, "Days", days.optional.name);
  await expect(optional).toContainText(days.optional.information);
  await expect(optional.getByLabel("Mandatory day")).toHaveCount(0);
}

test("admin creates and edits all year entities, volunteer sees the year", async ({
  adminPage: page,
  pageAs,
}) => {
  test.setTimeout(120_000);
  let yearId = "";

  await test.step("create a year", async () => {
    await page.goto("/create");
    await page.getByLabel("Year Name").fill(yearName);
    await page.getByRole("button", { name: "Create Year" }).click();
    await expect(page).toHaveURL(/\/\d+$/);
    yearId = new URL(page.url()).pathname.split("/").pop() ?? "";

    // The new year is selected in the year selector and is in its list
    const selector = page.getByRole("combobox", { name: "Year" });
    await expect(selector).toHaveText(yearName);
    await selector.click();
    await expect(
      page.getByRole("option", { name: yearName, exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    await page
      .getByRole("navigation")
      .getByRole("link", { name: "Settings" })
      .click();
    await expect(page).toHaveURL(`/${yearId}/settings`);
    await expect(
      page.getByRole("heading", { name: "Year Settings" }),
    ).toBeVisible();
    await expect(page.getByText(`Year Name: ${yearName}`)).toBeVisible();
    await expect(page.getByText(/Registration Status:\s*Closed/)).toBeVisible();
  });

  await test.step("rename the year and open registration", async () => {
    const info = section(page, "Year Information");
    await info.getByRole("button", { name: "Edit" }).click();
    await info.getByLabel("Year Name").fill(yearRenamed);
    await info.getByLabel("Open for Registration").check();
    await info.getByRole("button", { name: "Save Changes" }).click();

    await expect(info.getByText(`Year Name: ${yearRenamed}`)).toBeVisible();
    await expect(
      info.getByText(/Registration Status:\s*Open/),
    ).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Year" })).toHaveText(
      yearRenamed,
    );
  });

  await test.step("add positions, halls and days", async () => {
    await addPosition(page, positions.regular, { canDesire: true });
    await addPosition(page, positions.halls, {
      canDesire: true,
      hasHalls: true,
    });
    await addPosition(page, positions.manager, { isManager: true });

    await addHall(page, halls.a);
    await addHall(page, halls.b);

    await addDay(page, days.mandatory, true);
    await addDay(page, days.optional, false);

    await expectCreatedEntities(page);
  });

  await test.step("created entities survive a page reload", async () => {
    await page.reload();
    await expect(page.getByText(`Year Name: ${yearRenamed}`)).toBeVisible();
    await expect(page.getByText(/Registration Status:\s*Open/)).toBeVisible();
    await expectCreatedEntities(page);
  });

  await test.step("edit a position", async () => {
    await item(page, "Positions", positions.regular.name).click();
    const dialog = page.getByRole("dialog", { name: "Edit Position" });
    await expect(dialog.getByLabel("Position Name")).toHaveValue(
      positions.regular.name,
    );
    await dialog.getByLabel("Position Name").fill(regularRenamed);
    await dialog.getByLabel("Description").fill(regularDescriptionEdited);
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(item(page, "Positions", regularRenamed)).toContainText(
      regularDescriptionEdited,
    );
  });

  await test.step("edit a hall", async () => {
    await item(page, "Halls", halls.b.name)
      .getByRole("button")
      .click();
    const dialog = page.getByRole("dialog", { name: "Edit Hall" });
    await expect(dialog.getByLabel("Hall Name")).toHaveValue(halls.b.name);
    await dialog.getByLabel("Description").fill(hallBDescriptionEdited);
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog).toBeHidden();
    await expect(item(page, "Halls", halls.b.name)).toContainText(
      hallBDescriptionEdited,
    );
  });

  await test.step("edit a day", async () => {
    await item(page, "Days", days.optional.name).click();
    const dialog = page.getByRole("dialog", { name: "Edit Day" });
    await expect(dialog.getByLabel("Day Name")).toHaveValue(days.optional.name);
    await dialog.getByLabel("Day Name").fill(optionalDayRenamed);
    await dialog.getByLabel("Information").fill(optionalDayInformationEdited);
    await dialog.getByLabel("Mandatory day").check();
    await dialog.getByRole("button", { name: "Save Changes" }).click();
    await expect(dialog).toBeHidden();
    const edited = item(page, "Days", optionalDayRenamed);
    await expect(edited).toContainText(optionalDayInformationEdited);
    await expect(edited.getByLabel("Mandatory day")).toBeVisible();
  });

  await test.step("edits survive a page reload", async () => {
    await page.reload();
    await expect(item(page, "Positions", regularRenamed)).toContainText(
      regularDescriptionEdited,
    );
    await expect(item(page, "Halls", halls.b.name)).toContainText(
      hallBDescriptionEdited,
    );
    await expect(item(page, "Days", optionalDayRenamed)).toContainText(
      optionalDayInformationEdited,
    );
  });

  await test.step("days are in the sidebar and the day page opens", async () => {
    const nav = page.getByRole("navigation");
    await expect(
      nav.getByRole("link", { name: days.mandatory.name, exact: true }),
    ).toBeVisible();
    const dayLink = nav.getByRole("link", {
      name: optionalDayRenamed,
      exact: true,
    });
    await expect(dayLink).toBeVisible();
    await dayLink.click();
    await expect(page).toHaveURL(new RegExp(`/${yearId}/days/\\d+$`));
    await expect(
      page.getByRole("heading", { name: /Volunteer Assignments/ }),
    ).toBeVisible();
  });

  await test.step("volunteer sees the opened year", async () => {
    const vol = await pageAs("vol1");
    await vol.goto("/");
    await vol.getByRole("combobox", { name: "Year" }).click();
    await vol.getByRole("option", { name: yearRenamed, exact: true }).click();
    await expect(vol).toHaveURL(`/${yearId}`);

    // Days of the year are in the volunteer's sidebar
    const nav = vol.getByRole("navigation");
    await expect(
      nav.getByRole("link", { name: days.mandatory.name, exact: true }),
    ).toBeVisible();
    await expect(
      nav.getByRole("link", { name: optionalDayRenamed, exact: true }),
    ).toBeVisible();
    // Admin pages are hidden from the volunteer
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);

    await nav.getByRole("link", { name: "Registration Form" }).click();
    await expect(vol).toHaveURL(`/${yearId}/registration`);
    await expect(
      vol.getByRole("heading", { name: "Registration Form" }),
    ).toBeVisible();
    // Registration is open, so the form is editable
    await expect(vol.getByRole("button", { name: "Submit" })).toBeVisible();
    await expect(vol.getByLabel("First Name (RU) *")).toBeEnabled();

    // Only the desirable positions are offered
    await vol.getByRole("combobox", { name: "Desired Positions" }).click();
    const listbox = vol.getByRole("listbox");
    await expect(
      listbox.getByRole("option", { name: regularRenamed }),
    ).toBeVisible();
    await expect(
      listbox.getByRole("option", { name: positions.halls.name }),
    ).toBeVisible();
    await expect(
      listbox.getByRole("option", { name: positions.manager.name }),
    ).toHaveCount(0);
    await vol.keyboard.press("Escape");
  });
});
