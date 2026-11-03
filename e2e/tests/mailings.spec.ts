import { telegramMessages } from "../support/external";
import { expect, test } from "../support/fixtures";
import { RUN_TAG, users } from "../support/users";

/** Name of the recipient as the mailing shows it. */
const recipientName = (key: "vol1" | "vol2" | "vol3") =>
  `${users[key].lastNameRu} ${users[key].firstNameRu} ${users[key].patronymicRu}`;

// The admin sends a Telegram mailing to the volunteers assigned to a day: picks the
// recipients by an assignment filter, writes a template with the assignment in Monaco,
// checks the preview, starts the mailing and follows it until it's done (server-sent
// events). The Telegram mock gets a personalized message with a link button.
test("admin sends a mailing to the volunteers of a day", async ({
  adminPage: page,
  adminApi,
  apiAs,
}) => {
  test.setTimeout(120_000);

  // --- Preconditions via API ---
  const yearId = await adminApi.createYear(`E2E Mailing ${RUN_TAG}`);
  await adminApi.editYear(yearId, { open_for_registration: true });
  const usher = `Usher ${RUN_TAG}`;
  const positionId = await adminApi.createPosition({
    year_id: yearId,
    name: usher,
  });
  const day1 = `Opening ${RUN_TAG}`;
  const day1Id = await adminApi.createDay({
    year_id: yearId,
    name: day1,
    assignment_published: true,
  });
  const day2Id = await adminApi.createDay({
    year_id: yearId,
    name: `Closing ${RUN_TAG}`,
  });
  const emptyDay = `No assignments ${RUN_TAG}`;
  await adminApi.createDay({
    year_id: yearId,
    name: emptyDay,
    assignment_published: true,
  });
  const userIds: Record<string, number> = {};
  for (const key of ["vol1", "vol2", "vol3"] as const) {
    const api = await apiAs(key);
    await api.apply(yearId, { desired_positions_ids: [positionId] });
    userIds[key] = (await api.me()).user_id;
  }
  await adminApi.assign({
    application_form_id: await adminApi.formIdOf(yearId, userIds.vol1),
    day_id: day1Id,
    position_id: positionId,
  });
  await adminApi.assign({
    application_form_id: await adminApi.formIdOf(yearId, userIds.vol2),
    day_id: day2Id,
    position_id: positionId,
  });

  // --- Draft ---
  await page.goto(`/${yearId}/mailings`);
  await expect(page.getByRole("heading", { name: "Mailings" })).toBeVisible();
  await page.getByRole("button", { name: "New mailing" }).click();
  const title = `Briefing ${RUN_TAG}`;
  await page.getByTestId("mailing-title").fill(title);

  const recipients = page.getByTestId("mailing-recipients");
  const recipientRows = recipients.getByTestId("mailing-recipient");
  const selectAllRow = page.getByTestId("mailing-select-all");
  const selectAll = selectAllRow.getByRole("checkbox", {
    name: "Select all / Clear selection",
  });
  const sendTo = (key: "vol1" | "vol2" | "vol3") =>
    recipients.getByRole("checkbox", {
      name: `Send to ${recipientName(key)}`,
    });

  // Without a filter: all application forms of the year
  await expect(recipientRows).toHaveCount(3);
  await expect(selectAll).toBeChecked();

  await test.step("select and clear all recipients", async () => {
    await selectAllRow.click();
    for (const key of ["vol1", "vol2", "vol3"] as const) {
      await expect(sendTo(key)).not.toBeChecked();
    }
    await expect(selectAll).not.toBeChecked();

    await selectAllRow.click();
    for (const key of ["vol1", "vol2", "vol3"] as const) {
      await expect(sendTo(key)).toBeChecked();
    }

    await sendTo("vol1").click();
    await expect(sendTo("vol1")).not.toBeChecked();
    await expect(selectAll).toHaveAttribute("data-indeterminate", "true");
    await selectAllRow.click();
    for (const key of ["vol1", "vol2", "vol3"] as const) {
      await expect(sendTo(key)).toBeChecked();
    }
  });

  await test.step("disable selection for an empty recipient list", async () => {
    await page.getByRole("combobox", { name: "Days" }).click();
    await page.getByRole("option", { name: emptyDay }).click();
    await page.keyboard.press("Escape");
    await expect(recipientRows).toHaveCount(0);
    await expect(selectAll).toBeDisabled();
    await page
      .getByTestId("mailing-filter-days")
      .getByRole("button", { name: "Clear" })
      .click();
    await expect(recipientRows).toHaveCount(3);
  });

  await test.step("preserve recipients hidden by a filter", async () => {
    await page.getByRole("combobox", { name: "Days" }).click();
    await page.getByRole("option", { name: day1 }).click();
    await page.keyboard.press("Escape");
    await expect(recipientRows).toHaveCount(1);
    await selectAllRow.click();
    await expect(sendTo("vol1")).not.toBeChecked();

    await page.getByRole("combobox", { name: "Days" }).focus();
    await page.keyboard.press("Backspace");
    await expect(recipientRows).toHaveCount(3);
    await expect(sendTo("vol1")).not.toBeChecked();
    await expect(sendTo("vol2")).toBeChecked();
    await expect(sendTo("vol3")).toBeChecked();
    await selectAllRow.click();
    await expect(sendTo("vol1")).toBeChecked();
  });

  await test.step("filter by day", async () => {
    await page.getByRole("combobox", { name: "Days" }).click();
    await page.getByRole("option", { name: day1 }).click();
    await page.keyboard.press("Escape");
    await expect(recipientRows).toHaveCount(1);
    await expect(recipients).toContainText(recipientName("vol1"));
  });

  await test.step("write the template in Monaco", async () => {
    await page.getByTestId("mailing-template").click();
    await page.keyboard.type("Hi, <b>{{ user.first_name_en }}</b>!");
    await page.keyboard.press("Escape");
    // Enter adds a line in the message, unlike in the one-line button fields
    await page.keyboard.press("Enter");
    await page.keyboard.type("{{ day.name }}: {{ position.name }}");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Add button" }).click();
    await page.getByTestId("mailing-button-text-0").click();
    await page.keyboard.type("Schedule");
    await page.keyboard.press("Escape");
    await page.getByTestId("mailing-button-url-0").click();
    await page.keyboard.type("https://example.com/days/{{ day.id }}");
    await page.keyboard.press("Escape");
  });

  const firstName = users.vol1.firstNameEn;
  // toHaveText collapses the line break to a space
  const expectedText = `Hi, ${firstName}! ${day1}: ${usher}`;
  await expect(page.getByTestId("telegram-message")).toHaveText(expectedText);
  await expect(page.getByRole("link", { name: "Schedule" })).toHaveAttribute(
    "href",
    `https://example.com/days/${day1Id}`,
  );
  await expect(page.getByTestId("mailing-save-state")).toHaveText("Saved");

  // --- Start and follow ---
  await page.getByRole("button", { name: "Start mailing" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Send", exact: true })
    .click();

  await expect(page.getByTestId("mailing-status")).toHaveText("Done", {
    timeout: 30_000,
  });
  await expect(page.getByTestId("mailing-counts")).toContainText("Sent: 1");
  await expect(page.getByTestId("mailing-messages")).toContainText(
    recipientName("vol1"),
  );

  await test.step("the volunteer got the message", async () => {
    const sent = (await telegramMessages()).filter(
      (m) => Number(m.params.chat_id) === users.vol1.telegramId,
    );
    const message = sent.find((m) => m.params.text?.includes(day1));
    expect(message?.params.text).toBe(
      `Hi, <b>${firstName}</b>!\n${day1}: ${usher}`,
    );
    expect(message?.params.parse_mode).toBe("HTML");
    expect(JSON.parse(message?.params.reply_markup ?? "{}")).toEqual({
      inline_keyboard: [
        [
          {
            text: "Schedule",
            url: `https://example.com/days/${day1Id}`,
          },
        ],
      ],
    });
  });

  await test.step("the mailing is in the history", async () => {
    await page.goto(`/${yearId}/mailings`);
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toContainText("Done");
    await expect(row).toContainText("1 / 1");
  });
});
