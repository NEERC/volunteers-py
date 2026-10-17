import type { BrowserContext } from "@playwright/test";
import { MOCK_URL } from "../stack.config.mjs";

/**
 * Mocks external systems called by the browser:
 *  - api.2ip.io (country detection) answers RU, so the Telegram login is hidden
 *  - Telegram login widget is never loaded
 * ITMO Keycloak and the Telegram Bot API are mocked by mock/server.mjs.
 */
export async function mockBrowserExternals(context: BrowserContext) {
  await context.route("https://api.2ip.io/**", (route) =>
    route.fulfill({ json: { ip: "127.0.0.1", code: "RU", country: "Russia" } }),
  );
  await context.route(/^https:\/\/([a-z]+\.)?telegram\.org\//, (route) =>
    route.abort(),
  );
}

export type TelegramCall = {
  method: string;
  params: Record<string, string>;
  at: string;
};

/** Telegram Bot API calls made by the backend, recorded by the mock server. */
export async function telegramMessages(): Promise<TelegramCall[]> {
  const response = await fetch(`${MOCK_URL}/__mock/telegram/messages`);
  const calls = (await response.json()) as TelegramCall[];
  return calls.filter((c) => c.method === "sendMessage");
}
