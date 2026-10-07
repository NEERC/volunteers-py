import { expect, type Page } from "@playwright/test";
import { KEYCLOAK_ISSUER, UI_URL } from "../stack.config.mjs";
import type { TestUser } from "./users";

/** Signs in on the mock ITMO ID page the browser was redirected to. */
export async function submitMockItmoLogin(page: Page, user: TestUser) {
  await page.waitForURL(`${KEYCLOAK_ISSUER}/**`);
  await page.locator("#username").fill(user.username);
  await page.locator("#given_name").fill(user.firstNameEn);
  await page.locator("#family_name").fill(user.lastNameEn);
  await page.locator("#email").fill(user.email);
  await page.locator("#kc-login").click();
  await page.waitForURL(`${UI_URL}/**`);
}

/**
 * Full login through the UI: "Sign in with ITMO ID" -> mock Keycloak -> back to the app.
 * Registers the user when the ITMO account is not known yet.
 * Returns whether the user has been registered by this call.
 */
export async function loginViaUi(page: Page, user: TestUser): Promise<boolean> {
  await page.goto("/login");
  await page.getByRole("button", { name: "Sign in with ITMO ID" }).click();
  await submitMockItmoLogin(page, user);

  const registerButton = page.getByRole("button", {
    name: "Register",
    exact: true,
  });
  // A known user is redirected away from /login, a new one gets the registration form
  const outcome = await Promise.race([
    registerButton.waitFor().then(() => "register" as const),
    page
      .waitForURL((url) => !url.pathname.endsWith("/login"))
      .then(() => "logged-in" as const),
  ]);

  let registered = false;
  if (outcome === "register") {
    await page.getByLabel("Name on Russian", { exact: true }).fill(user.firstNameRu);
    await page.getByLabel("Surname on Russian", { exact: true }).fill(user.lastNameRu);
    await page.getByLabel("Patronymic on Russian", { exact: true }).fill(user.patronymicRu);
    await page.getByLabel("First name in English", { exact: true }).fill(user.firstNameEn);
    await page.getByLabel("Last name in English", { exact: true }).fill(user.lastNameEn);
    await page.getByLabel("ISU Number", { exact: true }).fill(String(user.isuId));
    await page.getByLabel("Email", { exact: true }).fill(user.email);
    await registerButton.click();
    registered = true;
  }

  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const raw = window.localStorage.getItem("AuthStore");
        return raw ? JSON.parse(raw).refreshToken : null;
      }),
    )
    .toBeTruthy();
  return registered;
}
