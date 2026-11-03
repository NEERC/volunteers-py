import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { UI_URL } from "../stack.config.mjs";
import { Api } from "../support/api";
import { loginViaUi } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { authFile, type UserKey, users, usersStateFile } from "../support/users";

// Registers the admin and the volunteers of the run through the UI
// (mock ITMO ID -> registration form), saves their sessions and links
// Telegram accounts (required to apply for a year). The admin is shared by all
// runs, so it's registered by the first run on the database and logs in later.
for (const key of Object.keys(users) as UserKey[]) {
  test(`register ${key}`, async ({ page }) => {
    const user = users[key];
    const registered = await loginViaUi(page, user);
    if (key !== "admin") {
      expect(registered).toBe(true);
    }

    // The registered user is signed in and sees the linked ITMO account
    await expect(page.getByText("Linked accounts")).toBeVisible();
    await expect(page.getByText(user.username)).toBeVisible();

    mkdirSync(dirname(authFile(key)), { recursive: true });
    await page.context().storageState({ path: authFile(key) });

    const api = await Api.as(key);
    try {
      await api.linkTelegram(user);
    } finally {
      await api.dispose();
    }
  });
}

test("admin has the admin role", async () => {
  test.setTimeout(20_000);
  // Granted on registration by the backend, see ADMIN_USERNAME
  const api = await Api.as("admin");
  expect((await api.me()).is_admin).toBe(true);
  await api.dispose();

  // Save the users of the run for manual testing
  const state: Record<string, unknown> = { runTag: process.env.E2E_RUN_TAG, ui: UI_URL };
  for (const key of Object.keys(users) as UserKey[]) {
    const userApi = await Api.as(key);
    state[key] = { ...users[key], userId: (await userApi.me()).user_id };
    await userApi.dispose();
  }
  mkdirSync(dirname(usersStateFile), { recursive: true });
  writeFileSync(usersStateFile, JSON.stringify(state, null, 2));
});
