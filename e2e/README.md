# Smoke e2e tests

Playwright tests of the main scenarios through the real UI and backend.
Authentication itself is out of scope: external systems are mocked.

## What runs

`playwright test` starts an isolated stack (or reuses an already running one):

| Service | URL | |
|---|---|---|
| Mock of external systems | http://localhost:8099 | `mock/server.mjs`: ITMO Keycloak (OIDC code flow + PKCE) and Telegram Bot API |
| Backend | http://localhost:8001 | database `volunteers_e2e` in the dev Postgres (`docker-compose-dev.yaml`), migrated on start |
| UI (Vite) | http://localhost:3001 | proxies `/api` and `/socket.io` to the e2e backend |

Browser-side externals (api.2ip.io country detection, Telegram login widget) are mocked
with `page.route` in `support/external.ts`.

Ports and the database can be changed with `E2E_MOCK_PORT`, `E2E_BACKEND_PORT`, `E2E_UI_PORT`,
`E2E_DB_ADMIN_URL`, `E2E_DB_NAME`, see `stack.config.mjs`.

## Users

The `setup` project (`tests/auth.setup.ts`) registers an admin and three volunteers through
the UI (mock ITMO ID → registration form), grants the admin role directly in the database
(there is no API for it) and saves the sessions to `.auth/`. Every run has a unique tag
(`E2E_RUN_TAG`, a timestamp by default) used in usernames and entity names, so runs never
collide and nothing has to be cleaned up.

## Running

Requires the dev Postgres (`docker compose -f docker-compose-dev.yaml up db`), the backend
virtualenv in `.venv` and `pnpm install` in `ui/`.

```bash
pnpm --dir e2e install
pnpm --dir e2e exec playwright install chromium
pnpm --dir e2e test
pnpm --dir e2e report
```

## Failed tests

When a test fails, `support/diagnostics.ts` attaches to it, for every open page of every user
(admin, vol1, ...):

- a full-page screenshot labelled with the user;
- the page URL, an ARIA snapshot and a log of console messages, page errors, failed requests
  and HTTP errors (with API response bodies);
- a video of each user's session.

Playwright adds a trace (`pnpm --dir e2e exec playwright show-trace <trace.zip>`). With
`E2E_LOG_DIR` set, the output of the stack services goes to `<dir>/{mock,backend,ui}.log`, and
the tail of the backend and mock logs is attached too. Everything is in the HTML report.

## CI

`.github/workflows/e2e.yml` runs the suite on pushes and pull requests to `main` against a
Postgres service container. It uploads the HTML report and the service logs on every run, and
`test-results/` (traces, videos) when the tests fail.

## Manual testing on the test data

Data is never cleaned up after a run. To look around:

```bash
pnpm --dir e2e stack
```

Open http://localhost:3001, press "Sign in with ITMO ID" and enter any username on the mock
login page. Users of the last run (`e2e-admin-<tag>`, `e2e-vol1-<tag>`, ...) are listed in
`.state/users.json`; a new username registers a new user. Telegram notifications sent by the
backend are at http://localhost:8099/__mock/telegram/messages (in memory, reset on restart).

## Known issues

Problems found by the tests are described in [ISSUES.md](ISSUES.md).
