import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Api } from "../support/api";
import { loginViaUi } from "../support/auth";
import { mockBrowserExternals } from "../support/external";
import { expect, test } from "../support/fixtures";
import { authFile, makeUser, RUN_TAG, type TestUser } from "../support/users";

type UserDetails = {
  user_id: number;
  email: string | null;
  phone: string | null;
  identities: { provider: string; subject: string }[];
};

// Two accounts of the same person ("Тестов Тест"), registered via ITMO ID with
// Telegram linked, both applied for the same year: the admin finds them among the
// suspected duplicates and merges the newer one into the older one (keeping the
// id of the older account and the profile of the newer one), resolving
// the conflicts (application forms, ITMO ID and Telegram accounts).
test("admin merges duplicate accounts", async ({
  browser,
  adminPage: page,
  adminApi,
}) => {
  test.setTimeout(120_000);

  // --- Preconditions via API ---
  const yearName = `E2E Merge ${RUN_TAG}`;
  const yearId = await adminApi.createYear(yearName);
  await adminApi.editYear(yearId, { open_for_registration: true });
  const positionId = await adminApi.createPosition({
    year_id: yearId,
    name: `Runner ${RUN_TAG}`,
  });
  const dayId = await adminApi.createDay({
    year_id: yearId,
    name: `Merge day ${RUN_TAG}`,
  });

  const register = async (user: TestUser, comments: string) => {
    const context = await browser.newContext();
    await mockBrowserExternals(context);
    expect(await loginViaUi(await context.newPage(), user)).toBe(true);
    mkdirSync(dirname(authFile(user.key)), { recursive: true });
    await context.storageState({ path: authFile(user.key) });
    await context.close();

    const api = await Api.as(user.key);
    try {
      await api.linkTelegram(user);
      await api.apply(yearId, { desired_positions_ids: [positionId], comments });
      return (await api.me()).user_id;
    } finally {
      await api.dispose();
    }
  };
  const older = makeUser("dup-old");
  const newer = makeUser("dup-new");
  const olderId = await register(older, "first form");
  const newerId = await register(newer, "second form");
  await adminApi.post(`/admin/user/${newerId}/edit`, {
    phone: "+79990000000",
    gender: null,
  });

  const newerFormId = await adminApi.formIdOf(yearId, newerId);
  const userDayId = await adminApi.assign({
    application_form_id: newerFormId,
    day_id: dayId,
    position_id: positionId,
  });
  await adminApi.addAssessment({
    user_day_id: userDayId,
    comment: "great",
    value: 5,
  });

  // --- Suspected duplicates in the users list ---
  await page.goto("/users");
  await page.getByPlaceholder("Search users...").fill(RUN_TAG);
  await page.getByLabel("Suspected duplicates").check();
  const rows = page.getByRole("row").filter({ hasText: RUN_TAG });
  await expect(rows.filter({ hasText: older.lastNameEn })).toHaveCount(1);
  await expect(rows.filter({ hasText: newer.lastNameEn })).toHaveCount(1);

  // --- Merge from the page of the newer account ---
  await page.goto(`/users/${newerId}`);
  await page.getByRole("button", { name: "Merge accounts" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Account to merge with").fill(older.username);
  await page.getByRole("option", { name: older.email }).click();

  await expect(
    dialog.getByText(`Account #${olderId} (the older one) is kept`),
  ).toBeVisible();
  const mergeButton = dialog.getByRole("button", { name: "Merge", exact: true });
  await expect(mergeButton).toBeDisabled();

  // Keep the form of the newer account (it has the assignment), its ITMO ID
  // account and the Telegram account of the older one
  await dialog.getByRole("radio", { name: "second form" }).check();
  await dialog
    .getByRole("radio", { name: `kc-${newer.username}`, exact: false })
    .check();
  await dialog
    .getByRole("radio", { name: `ID: ${older.telegramId}`, exact: false })
    .check();
  await mergeButton.click();

  // The newer account is gone, the page of the older one is opened
  await expect(page).toHaveURL(new RegExp(`/users/${olderId}$`));
  await expect(dialog).toBeHidden();
  await expect(adminApi.get(`/admin/user/${newerId}`)).rejects.toThrow(/404/);

  const merged = await adminApi.get<UserDetails>(`/admin/user/${olderId}`);
  // The profile is taken from the newer account
  expect(merged.email).toBe(newer.email);
  expect(merged.phone).toBe("+79990000000");
  expect(
    merged.identities.map((i) => `${i.provider}:${i.subject}`).sort(),
  ).toEqual([`keycloak:kc-${newer.username}`, `telegram:${older.telegramId}`]);

  const { forms } = await adminApi.registrationForms(yearId);
  expect(forms.map((f) => [f.form_id, f.user_id])).toEqual([
    [newerFormId, olderId],
  ]);
});
