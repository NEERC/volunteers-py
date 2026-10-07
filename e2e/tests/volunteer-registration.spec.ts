import { Api } from "../support/api";
import { loginViaUi } from "../support/auth";
import { mockBrowserExternals } from "../support/external";
import { expect, test } from "../support/fixtures";
import { makeUser, RUN_TAG, users } from "../support/users";
import {
  type Application,
  ApplicationForm,
} from "../support/volunteer-registration";

// Volunteers sign up in the system and apply for a year.
test.describe.configure({ mode: "serial" });

const POSITIONS = {
  desk: `Registration desk ${RUN_TAG}`,
  steward: `Hall steward ${RUN_TAG}`,
  photo: `Photographer ${RUN_TAG}`,
};
const DESIRABLE = Object.values(POSITIONS);
const NOT_DESIRABLE = `Coordinator ${RUN_TAG}`;

const applications: Record<"vol1" | "vol2" | "vol3", Application> = {
  vol1: {
    positions: [POSITIONS.desk, POSITIONS.steward],
    itmoGroup: "M3101",
    comments: `vol1 comment ${RUN_TAG}`,
    additionalSkills: "First aid",
    phone: "+79000000001",
    gender: "Female",
  },
  vol2: {
    positions: [POSITIONS.photo],
    itmoGroup: "M3202",
    comments: `vol2 comment ${RUN_TAG}`,
    additionalSkills: "Photography, video editing",
    phone: "+79000000002",
    gender: "Male",
  },
  vol3: {
    positions: [POSITIONS.steward, POSITIONS.photo],
    itmoGroup: "M3303",
    comments: `vol3 comment ${RUN_TAG}`,
    additionalSkills: "English C1",
    phone: "+79000000003",
    gender: "Female",
  },
};

// vol3 changes their mind and resubmits the application
const vol3Edited: Application = {
  ...applications.vol3,
  positions: [POSITIONS.desk],
  itmoGroup: "M3333",
  comments: `vol3 edited comment ${RUN_TAG}`,
  additionalSkills: "English C1, German B2",
};

let yearId: number;

test.beforeAll(async () => {
  const admin = await Api.as("admin");
  try {
    yearId = await admin.createYear(`Registration smoke ${RUN_TAG}`);
    await admin.editYear(yearId, { open_for_registration: true });
    for (const name of DESIRABLE) {
      await admin.createPosition({ year_id: yearId, name, can_desire: true });
    }
    await admin.createPosition({
      year_id: yearId,
      name: NOT_DESIRABLE,
      can_desire: false,
    });
    await admin.createDay({ year_id: yearId, name: `Day 1 ${RUN_TAG}` });
    await admin.createDay({ year_id: yearId, name: `Day 2 ${RUN_TAG}` });
  } finally {
    await admin.dispose();
  }
});

test("a new user signs up via ITMO ID and signs in again", async ({
  browser,
}) => {
  const newbie = makeUser("newbie");
  const context = await browser.newContext();
  await mockBrowserExternals(context);
  const page = await context.newPage();

  // First sign-in: the registration form is shown and filled
  expect(await loginViaUi(page, newbie)).toBe(true);
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(
    page.getByText("Welcome to the volunteer system", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(newbie.username)).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("button", { name: "Sign in with ITMO ID" }),
  ).toBeVisible();

  // Second sign-in: the account is known, no registration form
  expect(await loginViaUi(page, newbie)).toBe(false);
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(
    page.getByText("Welcome to the volunteer system", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText(newbie.username)).toBeVisible();

  await context.close();
});

test("volunteers fill in the application form", async ({ pageAs }) => {
  for (const key of ["vol1", "vol2", "vol3"] as const) {
    await test.step(key, async () => {
      const page = await pageAs(key);
      const form = new ApplicationForm(page);
      await form.open(yearId, users[key]);

      // Only desirable positions are offered
      const offered = await form.offeredPositions();
      expect([...offered].sort()).toEqual([...DESIRABLE].sort());
      expect(offered).not.toContain(NOT_DESIRABLE);

      await form.fill(applications[key]);
      await form.submitAndExpectSaved();

      await page.reload();
      await form.open(yearId, users[key]);
      await form.expectShows(applications[key], DESIRABLE);
    });
  }
});

test("a volunteer edits the application", async ({ pageAs }) => {
  const page = await pageAs("vol3");
  const form = new ApplicationForm(page);
  await form.open(yearId, users.vol3);
  await form.expectShows(applications.vol3, DESIRABLE);

  await form.fill(vol3Edited);
  await form.submitAndExpectSaved();

  await page.reload();
  await form.open(yearId, users.vol3);
  await form.expectShows(vol3Edited, DESIRABLE);
});

test("admin sees the applications and the registered volunteers", async ({
  adminPage: page,
}) => {
  const submitted = { ...applications, vol3: vol3Edited };

  await page.goto(`/${yearId}/registration-forms`);
  await expect(
    page.getByText(/All registration forms for this year \(3 forms\)/),
  ).toBeVisible();
  for (const key of ["vol1", "vol2", "vol3"] as const) {
    const user = users[key];
    const application = submitted[key];
    const card = page
      .locator(".MuiCard-root")
      .filter({ hasText: `${user.firstNameEn} ${user.lastNameEn}` });
    await expect(card).toHaveCount(1);
    await expect(card).toContainText(
      `${user.lastNameRu} ${user.firstNameRu} ${user.patronymicRu}`,
    );
    await expect(card).toContainText(application.itmoGroup);
    await expect(card).toContainText(application.comments);
    await expect(card).toContainText(application.additionalSkills);
    for (const position of DESIRABLE) {
      const chip = card.locator(".MuiChip-root", { hasText: position });
      await expect(chip).toHaveCount(
        application.positions.includes(position) ? 1 : 0,
      );
    }
  }
  await expect(page.getByText(NOT_DESIRABLE)).toHaveCount(0);

  await page.goto(`/${yearId}/contacts`);
  const search = page.getByPlaceholder("Search users...");
  for (const key of ["vol1", "vol2", "vol3"] as const) {
    const user = users[key];
    await search.fill(user.lastNameEn);
    await expect(
      page.getByText(`${user.firstNameEn} ${user.lastNameEn}`, { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(submitted[key].phone)).toBeVisible();
    await expect(page.getByText("Registered", { exact: true })).toHaveCount(1);
    await expect(page.getByText("Not Registered", { exact: true })).toHaveCount(
      0,
    );
  }
});
