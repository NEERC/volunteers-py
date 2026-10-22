# Deployment

The app is deployed from the images built by `.github/workflows/docker.yml`
(`ghcr.io/neerc/volunteers-py/<image>:sha-<commit>`), nothing is built on the servers.

| File | |
|---|---|
| `compose.yaml` | base: database, migrations, backend, frontend, proxy |
| `compose.stand.yaml` | test stand: the proxy is published by nginx-proxy at `https://<STAND_HOST>` |
| `compose.mock.yaml` | external systems (ITMO Keycloak, Telegram) are replaced by `e2e/mock` |
| `proxy-mock.conf` | proxy location of the mock (`/__mock/`) |
| `compose.prod.yaml` | production: the proxy on `PUBLIC_PORT`, daily database backups |
| `stand.sh` | runs on the servers over SSH: `up`, `destroy`, `list` for stands, `prod` for production |

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

## Production

`.github/workflows/deploy-prod.yml`, a manual run on `main` approved by a reviewer of the
`production` environment:

1. checks that the images `sha-<commit>` exist (built by `docker.yml` on every push to `main`);
2. uploads `compose.yaml`, `compose.prod.yaml`, `.env` and `backend.env` to `PROD_DIR`;
3. pulls the images, backs the database up to `PROD_DIR/backups` (`backup/backup.sh`, the
   same as the daily backups) and runs `docker compose up --wait`, which waits for the
   healthchecks of all services, the proxy being the last one.

Inputs:

- `tag`: images to deploy, `sha-<short commit>`. The commit of the run (the head of `main`)
  by default. **A rollback is a run with the tag of an older commit.** Migrations are not
  rolled back: if the old backend does not work with the new schema, restore the backup
  made before the deploy (see below).
- `dry_run`: uploads the files and pulls the images, the running containers and the
  database are not touched. Note that `.env` in `PROD_DIR` then has the new tag, so a
  `docker compose up` by hand would start it.

The app is served by an external nginx of the server, which proxies
`https://<domain>/volunteers/` to the proxy container and strips the prefix. The `Upgrade`
and `Connection` headers let realtime updates (Socket.IO) switch to WebSocket, without them
they stay on long polling:

```nginx
location /volunteers/ {
    proxy_pass http://127.0.0.1:<PUBLIC_PORT>/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

`$connection_upgrade` is the usual map in the `http` block:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}
```

The database is published on `127.0.0.1:15432` of the server for manual access. Backups
(`backups/backup_<time>.sql`, `pg_dumpall` of the whole server) are made daily at 2:00
UTC, on start of the backup container and before every deploy, compressed after 2 days
and removed after 30. Their log is `backups/log.txt`. To restore one (errors about the
role `postgres` are expected):

```sh
cd <PROD_DIR>
docker compose stop backend proxy
docker compose exec -T db psql -U postgres -d postgres < backups/backup_<time>.sql
docker compose up --detach --wait
```

Files in the top level of `PROD_DIR` are replaced on every deploy, keep everything else in
subdirectories (`backups` is kept).

### Server

- a deploy user in the `docker` group, Docker Compose 2.24 or newer;
- the external nginx above, with the certificate of the domain.

### GitHub settings

Environment `production`: deployment branches limited to `main`, a required reviewer.

| Name | Kind | |
|---|---|---|
| `PROD_SSH_HOST`, `PROD_SSH_USER` | variables | SSH access to the server |
| `PROD_SSH_PORT` | variable | optional, 22 by default |
| `PROD_SSH_KNOWN_HOSTS` | variable | output of `ssh-keyscan <host>` |
| `PROD_SSH_KEY` | secret | private key of the deploy user |
| `PROD_DIR` | variable | directory of the deployment, relative to the home of the deploy user or absolute |
| `PUBLIC_PORT` | variable | port the external nginx proxies to |
| `COMPOSE_PROJECT_NAME` | variable | optional, `vms-production` by default. Names the database volume, don't change it after the first deploy |
| `PROD_URL` | variable | optional, `https://<domain>/volunteers/`: shown in the deployment and checked after it |
| `TELEGRAM_BOT_HANDLE`, `TELEGRAM_BOT_ORIGIN` | variables | Telegram login widget (`@bot`, `https://<domain>`) |
| `VOLUNTEERS_*` | secrets and variables | backend configuration as in `.env.example`, secrets for the tokens and passwords. The database and the server address are set by `compose.yaml` |

### Moving from `docker-compose-prod.yaml` (one time)

Before this setup production was built on the server from a checkout of the repository
with `docker-compose-prod.yaml` and `docker-compose-prod-appendix.yaml`. It moves to a new
directory, the database is copied with `pg_dump` and `pg_restore`, and the old directory
with its volume stays untouched as a fallback.

The old directory is called `<OLD_DIR>` below, its compose command is
`old="docker compose -f docker-compose-prod.yaml -f docker-compose-prod-appendix.yaml"`.
Don't `git pull` there: `docker-compose-prod.yaml` is gone from `main`.

1. **Settings.** Fill the `production` environment (above). The `VOLUNTEERS_*` values,
   `PUBLIC_PORT` and the Telegram bot (`VITE_TELEGRAM_BOT_*`) come from `<OLD_DIR>/.env`.
   `COMPOSE_PROJECT_NAME` must differ from the old project (`docker compose ls` on the
   server), otherwise the new deployment would use the old volume. Check what
   `docker-compose-prod-appendix.yaml` runs: it is not part of the new deployment.
2. **Dry run.** Run the workflow with `dry_run`. `PROD_DIR` gets the files and the images
   are pulled, the old production keeps working. Check the log of the run.
3. **Stop the old production** (the downtime starts), keeping its data:

   ```sh
   cd <OLD_DIR>
   $old stop
   $old start db
   $old exec -T db pg_dump -U postgres -d postgres -Fc > ~/volunteers-cutover.dump
   $old stop db
   ```

   Never `down -v` there. Check the dump: `pg_restore --list ~/volunteers-cutover.dump | head`
   (or `docker run --rm -i postgres:16 pg_restore --list < ~/volunteers-cutover.dump | head`).
4. **Restore into the new database:**

   ```sh
   cd <PROD_DIR>
   mkdir -p backups && mv ~/volunteers-cutover.dump backups/
   docker compose up --detach --wait db
   docker compose exec -T db pg_restore -U postgres -d postgres --no-owner --exit-on-error \
     < backups/volunteers-cutover.dump
   ```

   The new database must be empty before the restore. If the restore fails, drop the new
   database with `docker compose down -v` **in `<PROD_DIR>` only** and repeat this step.
5. **Deploy.** Run the workflow without `dry_run`. Migrations newer than the old production
   are applied. Check the app at `https://<domain>/volunteers/` (the downtime ends).
6. **If the new production does not work**, go back to the old one (the data written since
   the restore is lost):

   ```sh
   (cd <PROD_DIR> && docker compose stop)
   (cd <OLD_DIR> && $old start)
   ```

7. **Later**, when the new production has been working for a while, remove the old one by
   hand: `$old down -v` in `<OLD_DIR>`, then the directory.
