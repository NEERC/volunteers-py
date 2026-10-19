#!/bin/sh
# Manages a test stand on the staging server, run there over SSH from stands.yml:
#   ssh stand "sh -s -- <command> <stands dir> <name>" < deploy/stand.sh
# The script is read from stdin, so docker commands get </dev/null not to consume it.
#
# Commands:
#   up       pull the images and (re)start the stand, the files are uploaded beforehand.
#            With RESET_DB=1 (always for the mock mode) the database is dropped first.
#   destroy  stop the stand, drop its data and remove its directory
#   list     print the names of the stands
set -eu

command="$1"
stands_dir="$2"

if [ "$command" = list ]; then
  [ -d "$stands_dir" ] || exit 0
  for dir in "$stands_dir"/*/; do
    [ -f "$dir/.env" ] && basename "$dir"
  done
  exit 0
fi

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
    # Credentials for the images (GHCR_USER, GHCR_TOKEN) are prepended to the script by the
    # caller, so they are not on the command line; they live in the stand directory only
    # for the duration of the pull
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
