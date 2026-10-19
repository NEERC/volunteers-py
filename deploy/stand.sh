#!/bin/sh
# Manages the deployments on the servers, run there over SSH from stands.yml and
# deploy-prod.yml:
#   ssh stand "sh -s -- <command> <args>" < deploy/stand.sh
# The script is read from stdin, so docker commands get </dev/null not to consume it.
# Credentials for the images (GHCR_USER, GHCR_TOKEN) and the options are prepended to the
# script by the caller, so they are not on the command line.
#
# Commands:
#   up <stands dir> <name>       pull the images and (re)start the stand, the files are
#                                uploaded beforehand. With RESET_DB=1 (always for the mock
#                                mode) the database is dropped first.
#   destroy <stands dir> <name>  stop the stand, drop its data and remove its directory
#   list <stands dir>            print the names of the stands
#   prod <dir>                   pull the images, back the database up to <dir>/backups and
#                                (re)start production, the files are uploaded beforehand.
#                                With DRY_RUN=1 only checks the configuration and pulls.
set -eu

command="$1"

# Logs in to the registry with a docker config that lives in the deployment directory
# only for the duration of the script
docker_login() {
  export DOCKER_CONFIG="$PWD/.docker"
  trap 'rm -rf "$DOCKER_CONFIG"' EXIT
  mkdir -p "$DOCKER_CONFIG"
  # CLI plugins (docker compose) may be installed in the default config directory
  if [ -d "$HOME/.docker/cli-plugins" ]; then
    ln -sfn "$HOME/.docker/cli-plugins" "$DOCKER_CONFIG/cli-plugins"
  fi
  if [ -n "${GHCR_TOKEN:-}" ]; then
    printf '%s' "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USER" --password-stdin
  fi
}

case "$command" in
  list)
    stands_dir="$2"
    [ -d "$stands_dir" ] || exit 0
    for dir in "$stands_dir"/*/; do
      [ -f "$dir/.env" ] && basename "$dir"
    done
    exit 0
    ;;
  prod)
    cd "$2"
    docker_login
    docker compose config --quiet </dev/null
    docker compose pull --quiet </dev/null
    if [ "${DRY_RUN:-0}" = 1 ]; then
      docker compose config --images </dev/null | sort -u
      echo "Dry run: the files are in place and the images are pulled, nothing is started"
      exit 0
    fi
    mkdir -p backups
    touch backups/log.txt
    # Migrations are not rolled back, so the database is backed up before every deploy
    docker compose up --detach --wait db </dev/null
    # The output (pg_dumpall --verbose) goes to the log of the daily backups
    if docker compose run --rm --no-deps backup /usr/local/bin/backup.sh \
      >>backups/log.txt 2>&1 </dev/null; then
      grep '^Backup completed' backups/log.txt | tail -n 1
    else
      tail -n 20 backups/log.txt
      echo "The backup failed, nothing is deployed" >&2
      exit 1
    fi
    docker compose up --detach --wait --remove-orphans </dev/null
    docker compose ps </dev/null
    exit 0
    ;;
esac

stands_dir="$2"
name="$3"
# The name is a part of a path removed by destroy, so it's checked strictly
case "$name" in
  *[!a-z0-9-]*)
    echo "Invalid stand name: $name" >&2
    exit 1
    ;;
  preprod | pr-[0-9]*) ;;
  *)
    echo "Invalid stand name: $name" >&2
    exit 1
    ;;
esac
dir="$stands_dir/$name"

case "$command" in
  up)
    cd "$dir"
    docker_login
    docker compose pull --quiet </dev/null
    if [ "${RESET_DB:-0}" = 1 ]; then
      docker compose down --volumes --remove-orphans </dev/null
    fi
    docker compose up --detach --wait --remove-orphans </dev/null
    docker compose ps </dev/null
    ;;
  destroy)
    if [ -d "$dir" ]; then
      (cd "$dir" && docker compose down --volumes --remove-orphans </dev/null)
      rm -rf "$dir"
      echo "Stand $name is removed"
    else
      echo "Stand $name does not exist"
    fi
    ;;
  *)
    echo "Unknown command: $command" >&2
    exit 1
    ;;
esac
