import { expect, type Locator, type Page } from "@playwright/test";
import type { TestUser } from "./users";

/** What a volunteer enters in the year's application form. */
export type Application = {
  positions: string[];
  itmoGroup: string;
  comments: string;
  additionalSkills: string;
  phone: string;
  gender: "Male" | "Female" | "Prefer not to say";
};

/** Page object of the application form on `/$yearId/registration`. */
export class ApplicationForm {
  readonly positions: Locator;
  readonly gender: Locator;
  readonly itmoGroup: Locator;
  readonly comments: Locator;
  readonly additionalSkills: Locator;
  readonly phone: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.positions = page.getByRole("combobox", { name: /Desired Positions/ });
    // The gender select has no label linked to it (no labelId in the app)
    this.gender = page
      .locator(".MuiFormControl-root")
      .filter({ has: page.locator('input[name="gender"]') })
      .getByRole("combobox");
    this.itmoGroup = page.getByLabel("ITMO Group", { exact: true });
    this.comments = page.getByLabel("Comments", { exact: true });
    this.additionalSkills = page.getByLabel("Additional Skills", {
      exact: true,
    });
    this.phone = page.getByLabel("Phone *", { exact: true });
    this.submit = page.getByRole("button", { name: "Submit", exact: true });
  }

  /** Opens the form and waits until it is filled with the user's profile. */
  async open(yearId: number, user: TestUser) {
    await this.page.goto(`/${yearId}/registration`);
    await expect(
      this.page.getByRole("heading", { name: "Registration Form" }),
    ).toBeVisible();
    // The form is reinitialized when the profile arrives, wait for it before typing
    await expect(
      this.page.getByLabel("First Name (EN) *", { exact: true }),
    ).toHaveValue(user.firstNameEn);
    await expect(
      this.page.getByLabel("Last Name (EN) *", { exact: true }),
    ).toHaveValue(user.lastNameEn);
  }

  /** Names of the positions offered in the "Desired Positions" dropdown. */
  async offeredPositions(): Promise<string[]> {
    await this.positions.click();
    const options = this.page.getByRole("listbox").getByRole("option");
    await expect(options.first()).toBeVisible();
    const names = (await options.allInnerTexts()).map((n) => n.trim());
    await this.page.keyboard.press("Escape");
    await expect(this.page.getByRole("listbox")).toBeHidden();
    return names;
  }

  /** Makes exactly `wanted` positions selected. */
  async selectPositions(wanted: string[]) {
    await this.positions.click();
    const listbox = this.page.getByRole("listbox");
    const options = listbox.getByRole("option");
    await expect(options.first()).toBeVisible();
    for (const name of (await options.allInnerTexts()).map((n) => n.trim())) {
      const option = listbox.getByRole("option", { name, exact: true });
      const selected = (await option.getAttribute("aria-selected")) === "true";
      if (selected !== wanted.includes(name)) {
        await option.click();
        await expect(option).toHaveAttribute(
          "aria-selected",
          String(!selected),
        );
      }
    }
    await this.page.keyboard.press("Escape");
    await expect(listbox).toBeHidden();
  }

  async selectGender(gender: Application["gender"]) {
    await this.gender.click();
    await this.page.getByRole("option", { name: gender, exact: true }).click();
    await expect(this.gender).toHaveText(gender);
  }

  async fill(application: Application) {
    await this.phone.fill(application.phone);
    await this.selectGender(application.gender);
    await this.selectPositions(application.positions);
    await this.itmoGroup.fill(application.itmoGroup);
    await this.comments.fill(application.comments);
    await this.additionalSkills.fill(application.additionalSkills);
  }

  async submitAndExpectSaved() {
    await expect(this.submit).toBeEnabled();
    await this.submit.click();
    await expect(
      this.page.getByText("Registration saved successfully!"),
    ).toBeVisible();
  }

  /** Checks the form shows the saved application. */
  async expectShows(application: Application, allPositions: string[]) {
    for (const name of allPositions) {
      if (application.positions.includes(name)) {
        await expect(this.positions).toContainText(name);
      } else {
        await expect(this.positions).not.toContainText(name);
      }
    }
    await expect(this.gender).toHaveText(application.gender);
    await expect(this.phone).toHaveValue(application.phone);
    await expect(this.itmoGroup).toHaveValue(application.itmoGroup);
    await expect(this.comments).toHaveValue(application.comments);
    await expect(this.additionalSkills).toHaveValue(
      application.additionalSkills,
    );
  }
}
