import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { services, UI_URL } from "./stack.config.mjs";

// Unique tag of the run: entities and users get it in their names, so runs never
// collide and nothing has to be cleaned up. Inherited by the workers.
process.env.E2E_RUN_TAG ??= `${new Date()
  .toISOString()
  .replace(/\D/g, "")
  .slice(2, 14)}${Math.random().toString(36).slice(2, 4)}`;

// When set (CI), output of the stack services goes to <dir>/<service>.log, and failed
// tests get the tail of the backend and mock logs attached
const logDir = process.env.E2E_LOG_DIR
  ? resolve(process.env.E2E_LOG_DIR)
  : undefined;
if (logDir) {
  process.env.E2E_LOG_DIR = logDir;
  mkdirSync(logDir, { recursive: true });
}

export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 4,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: UI_URL,
    locale: "en-US",
    trace: "retain-on-failure",
    // Failure screenshots of all pages (full page, labelled by user) and page logs are
    // attached by the failureDiagnostics fixture, see support/diagnostics.ts
    screenshot: "off",
    video: "retain-on-failure",
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      name: "smoke",
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],
  webServer: services.map(({ name, command, cwd, env, url }) => ({
    command: logDir ? `${command} > "${logDir}/${name}.log" 2>&1` : command,
    cwd,
    env: { ...(process.env as Record<string, string>), ...(env as Record<string, string>) },
    url,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: "ignore",
    stderr: "pipe",
  })),
});
