import type { Locator, Page } from "@playwright/test";
import type { Api } from "../support/api";
import { telegramMessages } from "../support/external";
import { expect, test } from "../support/fixtures";
import { RUN_TAG, type UserKey, users, VOLUNTEERS } from "../support/users";

type Volunteer = "vol1" | "vol2" | "vol3";

type RegistrationForm = {
  form_id: number;
  user_id: number;
  first_name_en: string;
  last_name_en: string;
};

type Assignment = {
  user_day_id: number;
  application_form_id: number;
  position_id: number;
  hall_id: number | null;
};

/** Name of the volunteer as the admin assignment page shows it (DetailedUserCard). */
const cardName = (key: UserKey) =>
  `${users[key].lastNameRu} ${users[key].firstNameRu} ${users[key].patronymicRu}`;


/** Closest MUI Paper around the element (cards are Papers too, so they are skipped). */
const paperOf = (element: Locator) =>
  element.locator(
    "xpath=ancestor::div[contains(@class,'MuiPaper-root') and not(contains(@class,'MuiCard-root'))][1]",
  );

/** Page object of the admin day assignment page (/$yearId/days/$dayId/edit). */
class AssignmentBoard {
  constructor(readonly page: Page) {}

  async open(yearId: number, dayId: number) {
    await this.page.goto(`/${yearId}/days/${dayId}/edit`);
    await expect(
      this.page.getByRole("heading", { name: `Day Assignments - id=${dayId}` }),
    ).toBeVisible();
    await expect(this.page.getByText("Available Volunteers")).toBeVisible();
  }

  /** Volunteer card, wherever it is: in the drawer or in a position. */
  card(key: UserKey) {
    return this.page
      .locator(".MuiCard-root")
      .filter({ hasText: cardName(key) });
  }

  /** Column of a position without halls. */
  positionTitle(name: string) {
    return this.page.getByRole("heading", { name, exact: true });
  }

  position(name: string) {
    return paperOf(this.positionTitle(name));
  }

  /** Column of a hall that groups all the positions with halls. */
  hall(name: string) {
    return paperOf(this.page.getByRole("heading", { name, exact: true }));
  }

  positionInHallTitle(hall: string, position: string) {
    return this.hall(hall).getByText(position, { exact: true });
  }

  positionInHall(hall: string, position: string) {
    return paperOf(this.positionInHallTitle(hall, position));
  }

  assignedCount() {
    return this.page.getByText(/Current assignments: \d+/);
  }

  /** Click-to-assign: select the volunteer card, then click the target column. */
  async assign(key: UserKey, target: Locator) {
    const saved = this.page.waitForResponse(
      (r) =>
        r.url().includes("/api/v1/admin/user-day/") &&
        r.request().method() === "POST",
    );
    await this.card(key).click();
    await target.click();
    expect((await saved).ok()).toBe(true);
  }
}

async function dayAssignments(api: Api, dayId: number) {
  const { assignments } = await api.get<{ assignments: Assignment[] }>(
    `/admin/user-day/day/${dayId}/assignments`,
  );
  return assignments;
}

/** Assignments without ids, in a stable order, for comparison. */
const strip = (list: Assignment[]) =>
  list
    .map(({ application_form_id, position_id, hall_id }) => ({
      application_form_id,
      position_id,
      hall_id,
    }))
    .sort((a, b) => a.application_form_id - b.application_form_id);

/**
 * Preconditions: a year open for registration with a regular position, a position
 * with halls (2 halls), a manager position, 2 days, and vol1..vol3 applied.
 */
async function seedYear(
  adminApi: Api,
  apiAs: (key: UserKey) => Promise<Api>,
  label: string,
) {
  const tag = `${label} ${RUN_TAG}`;
  const names = {
    usher: `Usher ${tag}`,
    steward: `Hall steward ${tag}`,
    manager: `Manager ${tag}`,
    hallA: `Hall A ${tag}`,
    hallB: `Hall B ${tag}`,
    day1: `Day 1 ${tag}`,
    day2: `Day 2 ${tag}`,
  };
  const yearId = await adminApi.createYear(`Year ${tag}`);
  await adminApi.editYear(yearId, { open_for_registration: true });
  const ids = {
    usher: await adminApi.createPosition({ year_id: yearId, name: names.usher }),
    steward: await adminApi.createPosition({
      year_id: yearId,
      name: names.steward,
      has_halls: true,
    }),
    manager: await adminApi.createPosition({
      year_id: yearId,
      name: names.manager,
      is_manager: true,
      can_desire: false,
    }),
    hallA: await adminApi.createHall({ year_id: yearId, name: names.hallA }),
    hallB: await adminApi.createHall({ year_id: yearId, name: names.hallB }),
    day1: await adminApi.createDay({ year_id: yearId, name: names.day1 }),
    day2: await adminApi.createDay({ year_id: yearId, name: names.day2 }),
  };
  const formIds = {} as Record<Volunteer, number>;
  /** Names as the user-facing day page shows them ("First Last" in English). */
  const tableNames = {} as Record<Volunteer, string>;
  for (const key of VOLUNTEERS as Volunteer[]) {
    const api = await apiAs(key);
    // No desired positions: their chips would repeat position names on the cards
    await api.apply(yearId, { desired_positions_ids: [], itmo_group: "E2E" });
    const userId = (await api.me()).user_id;
    const { forms } = await adminApi.get<{
      forms: RegistrationForm[];
    }>(`/admin/year/${yearId}/registration-forms`);
    const form = forms.find((f) => f.user_id === userId);
    if (!form) throw new Error(`${key} has no application form`);
    formIds[key] = form.form_id;
    tableNames[key] = `${form.first_name_en} ${form.last_name_en}`;
  }
  return { yearId, names, ids, formIds, tableNames };
}

const ALL_ASSIGNED = "Current assignments: 3 volunteers assigned to positions";

test("admin assigns volunteers to positions, publishes and copies the day", async ({
  adminPage: page,
  adminApi,
  apiAs,
  pageAs,
}) => {
  test.setTimeout(150_000);
  const board = new AssignmentBoard(page);
  const { yearId, names, ids, formIds, tableNames } = await seedYear(
    adminApi,
    apiAs,
    "Assignments",
  );
  const { usher, steward, manager, hallA, hallB } = names;

  // --- 1. Assign through the UI ---
  await test.step("assign volunteers on day 1", async () => {
    await board.open(yearId, ids.day1);
    await expect(page.getByText("3 volunteers available")).toBeVisible();

    await board.assign("vol1", board.positionTitle(usher));
    await expect(board.position(usher)).toContainText(cardName("vol1"));

    await board.assign("vol2", board.positionInHallTitle(hallA, steward));
    await expect(board.positionInHall(hallA, steward)).toContainText(
      cardName("vol2"),
    );

    await board.assign("vol3", board.positionTitle(manager));
    await expect(board.position(manager)).toContainText(cardName("vol3"));

    await expect(board.assignedCount()).toHaveText(ALL_ASSIGNED);
    await expect(
      page.getByText("All volunteers have been assigned to positions"),
    ).toBeVisible();
  });

  const expectDay1Board = async (vol2Hall: string, otherHall: string) => {
    await expect(board.assignedCount()).toHaveText(ALL_ASSIGNED);
    await expect(board.position(usher)).toContainText(cardName("vol1"));
    await expect(board.position(usher)).toContainText("1 volunteer");
    await expect(board.positionInHall(vol2Hall, steward)).toContainText(
      cardName("vol2"),
    );
    await expect(board.positionInHall(otherHall, steward)).not.toContainText(
      cardName("vol2"),
    );
    await expect(board.position(manager)).toContainText(cardName("vol3"));
  };

  await test.step("assignments survive reload and are saved", async () => {
    await page.reload();
    await expectDay1Board(hallA, hallB);

    const saved = await dayAssignments(adminApi, ids.day1);
    expect(strip(saved)).toEqual(
      [
        { application_form_id: formIds.vol1, position_id: ids.usher, hall_id: null },
        { application_form_id: formIds.vol2, position_id: ids.steward, hall_id: ids.hallA },
        { application_form_id: formIds.vol3, position_id: ids.manager, hall_id: null },
      ].sort((a, b) => a.application_form_id - b.application_form_id),
    );
  });

  // --- 2. Change an assignment ---
  await test.step("move vol2 to another hall", async () => {
    await board.assign("vol2", board.positionInHallTitle(hallB, steward));
    await expect(board.positionInHall(hallB, steward)).toContainText(
      cardName("vol2"),
    );
    await page.reload();
    await expectDay1Board(hallB, hallA);

    const saved = await dayAssignments(adminApi, ids.day1);
    expect(saved).toHaveLength(3);
    expect(
      saved.find((a) => a.application_form_id === formIds.vol2),
    ).toMatchObject({ position_id: ids.steward, hall_id: ids.hallB });
  });

  // --- 4 (before publishing). The volunteer doesn't see the assignments ---
  const volunteerPage = await pageAs("vol1");
  const rowOf = (key: Volunteer) =>
    volunteerPage.getByRole("row").filter({ hasText: tableNames[key] });

  await test.step("volunteer doesn't see unpublished assignments", async () => {
    await volunteerPage.goto(`/${yearId}/days/${ids.day1}`);
    await expect(
      volunteerPage.getByRole("heading", { name: "Volunteer Assignments" }),
    ).toBeVisible();
    await expect(
      volunteerPage.getByText("Assignments are not yet published"),
    ).toBeVisible();
    await expect(volunteerPage.getByRole("table")).toHaveCount(0);
    await expect(volunteerPage.getByText(tableNames.vol1)).toHaveCount(0);
  });

  // --- 3. Publish ---
  await test.step("publish the day", async () => {
    const publish = page.getByLabel("Publish Assignments");
    await expect(publish).not.toBeChecked();
    await publish.click();
    await expect(publish).toBeChecked();
    await expect(publish).toBeEnabled();

    await page.reload();
    await expect(page.getByLabel("Publish Assignments")).toBeChecked();
    const days = await adminApi.get<
      { day_id: number; assignment_published: boolean }[]
    >(`/admin/day/year/${yearId}`);
    expect(
      days.find((d) => d.day_id === ids.day1)?.assignment_published,
    ).toBe(true);
  });

  // --- 4. The volunteer sees the published assignments ---
  await test.step("volunteer sees the published assignments", async () => {
    // Without reload the page doesn't update: realtime is broken, see the test below
    await volunteerPage.reload();
    await expect(
      volunteerPage.getByText("Assignments are not yet published"),
    ).toBeHidden();
    await expect(rowOf("vol1")).toContainText(usher);
    await expect(rowOf("vol1")).toContainText("No Hall");
    await expect(rowOf("vol2")).toContainText(`${steward}${hallB}`);
    await expect(rowOf("vol3")).toContainText(manager);
  });

  await test.step("volunteer sees a changed assignment", async () => {
    await board.assign("vol1", board.positionInHallTitle(hallA, steward));
    await expect(board.positionInHall(hallA, steward)).toContainText(
      cardName("vol1"),
    );
    await volunteerPage.reload();
    await expect(rowOf("vol1")).toContainText(`${steward}${hallA}`);
  });

  // --- 5. Copy assignments from day 1 to day 2 ---
  await test.step("copy assignments to day 2", async () => {
    await board.open(yearId, ids.day2);
    await expect(page.getByText("3 volunteers available")).toBeVisible();
    await expect(board.assignedCount()).toHaveCount(0);

    await page
      .getByRole("button", { name: "Copy assignments from day" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Copy assignments from day",
    });
    await dialog.getByRole("combobox").click();
    await page.getByRole("option", { name: names.day1, exact: true }).click();
    await expect(dialog.getByRole("radio", { name: /^Normal/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Copy Assignments" }).click();
    await expect(dialog).toBeHidden();

    await expect(board.assignedCount()).toHaveText(ALL_ASSIGNED);
    await expect(board.positionInHall(hallA, steward)).toContainText(
      cardName("vol1"),
    );
    await expect(board.positionInHall(hallB, steward)).toContainText(
      cardName("vol2"),
    );
    await expect(board.position(manager)).toContainText(cardName("vol3"));
    await expect(
      page.getByText("All volunteers have been assigned to positions"),
    ).toBeVisible();

    await page.reload();
    await expect(board.assignedCount()).toHaveText(ALL_ASSIGNED);
    expect(strip(await dayAssignments(adminApi, ids.day2))).toEqual(
      strip(await dayAssignments(adminApi, ids.day1)),
    );
  });

  // --- 6. Telegram notifications ---
  await test.step("telegram notifications were sent", async () => {
    const day1Texts = async () =>
      (await telegramMessages())
        .map((m) => m.params.text ?? "")
        .filter((text) => text.startsWith(`[${names.day1}]`));

    // 3 assignments + 2 moves (copying to day 2 doesn't notify)
    await expect.poll(async () => (await day1Texts()).length).toBe(5);
    const texts = await day1Texts();
    const vol = (key: UserKey) =>
      `${users[key].firstNameRu} ${users[key].lastNameRu}`;
    const sent = (key: UserKey, change: string) =>
      texts.some((text) => text.includes(vol(key)) && text.includes(change));

    expect(sent("vol1", `(unassigned) -> ${usher}`)).toBe(true);
    expect(sent("vol2", `(unassigned) -> ${steward} ${hallA}`)).toBe(true);
    expect(sent("vol3", `(unassigned) -> ${manager}`)).toBe(true);
    expect(sent("vol2", `${steward} ${hallA} -> ${steward} ${hallB}`)).toBe(
      true,
    );
    expect(sent("vol1", `${usher}  -> ${steward} ${hallA}`)).toBe(true);
  });
});

test("volunteer day page updates in realtime", async ({
  adminApi,
  apiAs,
  pageAs,
}) => {
  // App bug: volunteers/sockets/assignments.py `connect(sid, environ)` doesn't
  // accept the `auth` argument, but the UI always connects with
  // `auth: { token }`, so python-socketio raises TypeError, never acks the
  // namespace CONNECT and no `assignment_updated` event reaches the browser.
  test.fail(true, "socket.io connect handler rejects clients that send auth");

  const { yearId, ids, names, formIds, tableNames } = await seedYear(
    adminApi,
    apiAs,
    "Realtime",
  );
  await adminApi.editDay(ids.day1, { assignment_published: true });
  const userDayId = await adminApi.assign({
    application_form_id: formIds.vol1,
    day_id: ids.day1,
    position_id: ids.usher,
  });

  const page = await pageAs("vol1");
  await page.goto(`/${yearId}/days/${ids.day1}`);
  const row = page.getByRole("row").filter({ hasText: tableNames.vol1 });
  await expect(row).toContainText(names.usher);

  // The admin moves the volunteer, the open page picks it up via socket.io
  await adminApi.post(`/admin/user-day/${userDayId}/edit`, {
    position_id: ids.manager,
    hall_id: null,
  });
  await expect(row).toContainText(names.manager);
});
