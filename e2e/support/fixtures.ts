import { rmSync } from "node:fs";
import { test as base, type BrowserContext, type Page } from "@playwright/test";
import { Api } from "./api";
import {
  attachPagesDiagnostics,
  attachServiceLogs,
  testFailed,
  watchContext,
} from "./diagnostics";
import { mockBrowserExternals } from "./external";
import { authFile, type UserKey } from "./users";

type Fixtures = {
  /** Opens a page signed in as one of the setup users, in its own browser context. */
  pageAs: (key: UserKey) => Promise<Page>;
  /** Backend API client signed in as one of the setup users. */
  apiAs: (key: UserKey) => Promise<Api>;
  adminPage: Page;
  adminApi: Api;
  /** Attaches verbose diagnostics of all open pages when the test fails. */
  failureDiagnostics: void;
};

export const test = base.extend<Fixtures>({
  context: async ({ context }, use) => {
    watchContext(context, "page");
    await mockBrowserExternals(context);
    await use(context);
  },

  pageAs: async ({ browser }, use, testInfo) => {
    const contexts: { key: UserKey; context: BrowserContext; videoDir: string }[] =
      [];
    await use(async (key) => {
      const videoDir = testInfo.outputPath(`video-${key}-${contexts.length}`);
      const context = await browser.newContext({
        storageState: authFile(key),
        recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
      });
      watchContext(context, key);
      await mockBrowserExternals(context);
      contexts.push({ key, context, videoDir });
      return context.newPage();
    });
    const failed = testFailed(testInfo);
    for (const { key, context, videoDir } of contexts) {
      const videos = context.pages().map((page) => page.video());
      await context.close();
      for (const [index, video] of videos.entries()) {
        if (failed && video) {
          await testInfo.attach(`${key} video${index ? ` ${index + 1}` : ""}`, {
            path: await video.path(),
            contentType: "video/webm",
          });
        }
      }
      if (!failed) {
        rmSync(videoDir, { recursive: true, force: true });
      }
    }
  },

  apiAs: async ({}, use) => {
    const clients: Api[] = [];
    await use(async (key) => {
      const api = await Api.as(key);
      clients.push(api);
      return api;
    });
    for (const api of clients) {
      await api.dispose();
    }
  },

  adminPage: async ({ pageAs }, use) => {
    await use(await pageAs("admin"));
  },

  adminApi: async ({ apiAs }, use) => {
    await use(await apiAs("admin"));
  },

  // Depends on the context fixtures, so it's torn down before they close the pages
  failureDiagnostics: [
    async ({ browser, context: _context, pageAs: _pageAs }, use, testInfo) => {
      await use();
      if (testFailed(testInfo)) {
        await attachPagesDiagnostics(browser, testInfo);
        await attachServiceLogs(testInfo);
      }
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
