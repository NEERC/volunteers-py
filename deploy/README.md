# Deployment

The app is deployed from the images built by `.github/workflows/docker.yml`
(`ghcr.io/neerc/volunteers-py/<image>:sha-<commit>`), nothing is built on the servers.

| File | |
|---|---|
| `compose.yaml` | base: database, migrations, backend, frontend, proxy |
| `compose.stand.yaml` | test stand: the proxy is published by nginx-proxy at `https://<STAND_HOST>` |
| `compose.mock.yaml` | external systems (ITMO Keycloak, Telegram) are replaced by `e2e/mock` |
| `proxy-mock.conf` | proxy location of the mock (`/__mock/`) |
| `stand.sh` | runs on the staging server over SSH: `up`, `destroy`, `list` |

A deployment is a directory with these files, `.env` (variables of the compose files,
`COMPOSE_FILE` and `COMPOSE_PROJECT_NAME`) and optionally `backend.env` (`VOLUNTEERS_*`).
`docker compose` run in the directory picks everything up, e.g.
`cd ~/volunteers-stands/pr-42 && docker compose logs -f backend`.

The frontend image is the same for all deployments: the base path (`PUBLIC_URL`), the UI
badge (`MODE`) and the Telegram bot (`TELEGRAM_BOT_HANDLE`, `TELEGRAM_BOT_ORIGIN`) are
applied on container start by `ui/docker-entrypoint.sh`.

## Test stands

`.github/workflows/stands.yml` deploys stands to the staging server:

| Stand | When | External systems | Database |
|---|---|---|---|
| `pr-<N>` | label `deploy-stand` on a pull request (redeployed on every push while it's there), or a manual run on its branch | mocked | recreated on every deploy, filled by the e2e tests |
| `preprod` | manual run on `main` | real (environment `preprod`) | kept, `reset_db` input drops it |

A pull request stand is removed when the pull request is closed or the label is removed,
and by the nightly sweep for closed pull requests. A manual run with `destroy` removes
the stand of the branch. Pull requests from forks get no stand.

After a pull request stand is deployed, the e2e tests run against it
(`E2E_STAND_URL`, see `e2e/README.md`), and a comment in the pull request lists the URL,
the result and the users of the run. On a mock stand **Sign in with ITMO ID** accepts any
username (`e2e-admin` is an admin), Telegram messages are at `/__mock/telegram/messages`.
The Telegram login widget does not work there.

### Staging server

Set up by `ansible/staging.yml` from a clean Ubuntu 24.04 image, see `ansible/README.md`:

- [nginx-proxy](https://github.com/nginx-proxy/nginx-proxy) with
  [acme-companion](https://github.com/nginx-proxy/acme-companion), their docker network
  is `STAND_PROXY_NETWORK` (`proxy` by default);
- wildcard DNS record `*.<STAND_DOMAIN>` pointing to the server;
- a deploy user in the `docker` group, Docker Compose 2.24 or newer.

Stands live in `~/<STANDS_DIR>/<name>` of the deploy user, docker compose projects are
`vms-<name>`.

### GitHub settings

Repository variables and secrets (used by all stands):

| Name | Kind | |
|---|---|---|
| `STAND_DOMAIN` | variable | stands are `<name>.<STAND_DOMAIN>` |
| `STAND_SSH_HOST`, `STAND_SSH_USER` | variables | SSH access to the staging server |
| `STAND_SSH_PORT` | variable | optional, 22 by default |
| `STAND_SSH_KNOWN_HOSTS` | variable | output of `ssh-keyscan <host>` |
| `STAND_SSH_KEY` | secret | private key of the deploy user |
| `STAND_PROXY_NETWORK` | variable | optional, `proxy` by default |
| `STANDS_DIR` | variable | optional, `volunteers-stands` by default |

Environments:

- `staging`: pull request stands, nothing to configure (created on the first deploy);
- `preprod`: deployment branches limited to `main`. Secrets and variables `VOLUNTEERS_*`
  of the backend (as in `.env.example`, the database is configured by `compose.yaml`),
  variables `TELEGRAM_BOT_HANDLE` and `TELEGRAM_BOT_ORIGIN` (`https://preprod.<STAND_DOMAIN>`).
  The Keycloak client has to allow the redirect URI `https://preprod.<STAND_DOMAIN>/*`,
  the Telegram bot needs `/setdomain preprod.<STAND_DOMAIN>`.

The `deploy-stand` label has to exist in the repository.
