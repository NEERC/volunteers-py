import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import pg from "pg";
import { DB_URL, UI_URL } from "../stack.config.mjs";
import { Api } from "../support/api";
import { loginViaUi } from "../support/auth";
import { expect, test } from "../support/fixtures";
import { authFile, type UserKey, users, usersStateFile } from "../support/users";

// Registers the admin and the volunteers of the run through the UI
// (mock ITMO ID -> registration form) and saves their sessions.
for (const key of Object.keys(users) as UserKey[]) {
  test(`register ${key}`, async ({ page }) => {
    const user = users[key];
    const registered = await loginViaUi(page, user);
    expect(registered).toBe(true);

    // The registered user is signed in and sees the linked ITMO account
    await expect(page.getByText("Linked accounts")).toBeVisible();
    await expect(page.getByText(user.username)).toBeVisible();

    mkdirSync(dirname(authFile(key)), { recursive: true });
    await page.context().storageState({ path: authFile(key) });
  });
}

test("promote admin", async () => {
  test.setTimeout(20_000);
  // There is no API to grant the admin role, so it's done right in the database
  const api = await Api.as("admin");
  const { user_id } = await api.me();

  const client = new pg.Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query("UPDATE users SET is_admin = true WHERE id = $1", [
      user_id,
    ]);
  } finally {
    await client.end();
  }
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
