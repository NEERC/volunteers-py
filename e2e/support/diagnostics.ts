import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Browser, BrowserContext, Page, TestInfo } from "@playwright/test";

// Verbose diagnostics attached to a failed test: for every open page of every browser
// context a labelled full-page screenshot, the URL, an ARIA snapshot of the page and a log
// of console messages, page errors, failed requests and HTTP errors (with API response
// bodies), plus the tail of the stack service logs when they're written to files (CI).

const MAX_BODY = 2_000;
const LOG_TAIL_LINES = 300;

const contextLabels = new WeakMap<BrowserContext, string>();
const pageLogs = new WeakMap<Page, string[]>();

const time = () => new Date().toISOString().slice(11, 23);

function watchPage(page: Page) {
  if (pageLogs.has(page)) {
    return;
  }
  const log: string[] = [];
  pageLogs.set(page, log);
  const add = (line: string) => log.push(`${time()} ${line}`);

  page.on("console", (message) =>
    add(`[console.${message.type()}] ${message.text()}`),
  );
  page.on("pageerror", (error) =>
    add(`[pageerror] ${error.stack ?? error.message}`),
  );
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) {
      add(`[navigated] ${frame.url()}`);
    }
  });
  page.on("requestfailed", (request) =>
    add(
      `[requestfailed] ${request.method()} ${request.url()}: ${request.failure()?.errorText}`,
    ),
  );
  page.on("response", async (response) => {
    if (response.status() < 400) {
      return;
    }
    const request = response.request();
    let body = "";
    if (response.url().includes("/api/")) {
      body = await response
        .text()
        .then((text) => `\n    ${text.slice(0, MAX_BODY)}`)
        .catch(() => "");
    }
    add(
      `[http ${response.status()}] ${request.method()} ${response.url()}${body}`,
    );
  });
}

/** Starts collecting logs of the context's pages; the label names it in the attachments. */
export function watchContext(context: BrowserContext, label: string) {
  contextLabels.set(context, label);
  for (const page of context.pages()) {
    watchPage(page);
  }
  context.on("page", watchPage);
}

export function testFailed(testInfo: TestInfo) {
  return testInfo.status !== testInfo.expectedStatus;
}

async function describePage(page: Page, log: string[] | undefined) {
  const aria = await page
    .locator("body")
    .ariaSnapshot({ timeout: 5_000 })
    .catch((error: Error) => `(no ARIA snapshot: ${error.message})`);
  const title = await page.title().catch(() => "");
  return [
    `# ${title || "(no title)"}`,
    "",
    `URL: ${page.url()}`,
    "",
    "## Page log",
    "",
    "```",
    ...(log?.length ? log : ["(empty)"]),
    "```",
    "",
    "## ARIA snapshot",
    "",
    "```yaml",
    aria,
    "```",
    "",
  ].join("\n");
}

/** Attaches the diagnostics of all open pages, call it before the contexts are closed. */
export async function attachPagesDiagnostics(
  browser: Browser,
  testInfo: TestInfo,
) {
  let unnamed = 0;
  for (const context of browser.contexts()) {
    const label = contextLabels.get(context) ?? `context-${++unnamed}`;
    const pages = context.pages();
    for (const [index, page] of pages.entries()) {
      if (page.isClosed()) {
        continue;
      }
      const name = pages.length > 1 ? `${label}-tab${index + 1}` : label;
      const screenshot = await page
        .screenshot({ fullPage: true, timeout: 10_000 })
        .catch(() => null);
      if (screenshot) {
        await testInfo.attach(`${name} screenshot`, {
          body: screenshot,
          contentType: "image/png",
        });
      }
      await testInfo.attach(`${name} page`, {
        body: await describePage(page, pageLogs.get(page)),
        contentType: "text/markdown",
      });
    }
  }
}

/** Attaches the tail of the stack service logs (written to files when E2E_LOG_DIR is set). */
export async function attachServiceLogs(testInfo: TestInfo) {
  const dir = process.env.E2E_LOG_DIR;
  if (!dir) {
    return;
  }
  for (const service of ["backend", "mock"]) {
    const path = resolve(dir, `${service}.log`);
    if (!existsSync(path)) {
      continue;
    }
    const tail = readFileSync(path, "utf8")
      .split("\n")
      .slice(-LOG_TAIL_LINES)
      .join("\n");
    await testInfo.attach(`${service} log (tail)`, {
      body: tail,
      contentType: "text/plain",
    });
  }
}
