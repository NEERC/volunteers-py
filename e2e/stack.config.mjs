// Ports, URLs and environment of the isolated e2e stack.
// Shared by playwright.config.ts and scripts/stack.mjs (manual testing).
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const E2E_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(E2E_DIR, "..");

const port = (name, fallback) => Number(process.env[name] ?? fallback);

export const MOCK_PORT = port("E2E_MOCK_PORT", 8099);
export const BACKEND_PORT = port("E2E_BACKEND_PORT", 8001);
export const UI_PORT = port("E2E_UI_PORT", 3001);

// URL of a deployed test stand: its proxy serves the UI, the backend (/api) and the mock
// of external systems (/__mock). When set, the tests run against the stand and no local
// stack is started, see deploy/README.md.
export const STAND_URL = process.env.E2E_STAND_URL?.replace(/\/+$/, "");

export const MOCK_URL = STAND_URL ?? `http://localhost:${MOCK_PORT}`;
export const BACKEND_URL = STAND_URL ?? `http://localhost:${BACKEND_PORT}`;
export const UI_URL = STAND_URL ?? `http://localhost:${UI_PORT}`;

export const KEYCLOAK_ISSUER = STAND_URL
  ? `${STAND_URL}/__mock/realms/e2e`
  : `${MOCK_URL}/realms/e2e`;

/** ITMO ID username of the admin, who gets the role on registration (bootstrap admin). */
export const ADMIN_USERNAME = "e2e-admin";

export const DB_ADMIN_URL =
  process.env.E2E_DB_ADMIN_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";
export const DB_NAME = process.env.E2E_DB_NAME ?? "volunteers_e2e";
export const DB_URL = DB_ADMIN_URL.replace(/\/[^/]*$/, `/${DB_NAME}`);

/**
 * Environment of the backend: everything external points to the mock server.
 * Test stands in the mock mode use the same secrets, see deploy/compose.mock.yaml.
 */
export const backendEnv = {
  VOLUNTEERS_JWT__SECRET: "e2e-secret",
  VOLUNTEERS_JWT__ALGORITHM: "HS256",
  VOLUNTEERS_JWT__EXPIRATION: "3600",
  VOLUNTEERS_JWT__REFRESH_EXPIRATION: "15552000",
  VOLUNTEERS_TELEGRAM__TOKEN: "123456:e2e-telegram-token",
  VOLUNTEERS_TELEGRAM__EXPIRATION_TIME: "3600",
  VOLUNTEERS_TELEGRAM__API_SERVER: MOCK_URL,
  VOLUNTEERS_KEYCLOAK__ISSUER: KEYCLOAK_ISSUER,
  VOLUNTEERS_KEYCLOAK__CLIENT_ID: "volunteers",
  VOLUNTEERS_KEYCLOAK__CLIENT_SECRET: "e2e-client-secret",
  VOLUNTEERS_DATABASE__URL: DB_URL.replace(
    /^postgresql:/,
    "postgresql+asyncpg:",
  ),
  VOLUNTEERS_SERVER__PORT: String(BACKEND_PORT),
  VOLUNTEERS_SERVER__HOST: "127.0.0.1",
  VOLUNTEERS_LOGGING__LEVEL: "INFO",
  VOLUNTEERS_NOTIFICATION__TG_CHAT_ID: "-100",
  VOLUNTEERS_BOOTSTRAP__ADMINS: JSON.stringify([ADMIN_USERNAME]),
};

export const uiEnv = {
  API_PROXY_TARGET: BACKEND_URL,
  VITE_TELEGRAM_BOT_HANDLE: "@e2e_bot",
  VITE_TELEGRAM_BOT_ORIGIN: UI_URL,
};

/** Commands of the stack services, see playwright.config.ts webServer. */
export const services = [
  {
    name: "mock",
    command: "node mock/server.mjs",
    cwd: E2E_DIR,
    env: { E2E_MOCK_PORT: String(MOCK_PORT) },
    url: `${MOCK_URL}/__mock/health`,
  },
  {
    name: "backend",
    command: "sh e2e/scripts/backend.sh",
    cwd: REPO_ROOT,
    env: { ...backendEnv, E2E_DB_ADMIN_URL: DB_ADMIN_URL, E2E_DB_NAME: DB_NAME },
    url: `${BACKEND_URL}/hc`,
  },
  {
    name: "ui",
    command: `pnpm exec vite --port ${UI_PORT} --strictPort`,
    cwd: resolve(REPO_ROOT, "ui"),
    env: uiEnv,
    url: UI_URL,
  },
];
