#!/bin/sh
# Applies the configuration of the deployment to the built app, run by the nginx image
# entrypoint on container start (/docker-entrypoint.d). The image is built once with a
# placeholder base path, so the same image is served under any PUBLIC_URL.
set -eu

PUBLIC_URL="${PUBLIC_URL:-/}"
case "$PUBLIC_URL" in
  /*/ | /) ;;
  *)
    echo "PUBLIC_URL must start and end with a slash, got '$PUBLIC_URL'" >&2
    exit 1
    ;;
esac

# Base path placeholder, see the build command in Dockerfile
find /app/www -type f \( -name '*.html' -o -name '*.js' -o -name '*.css' -o -name '*.json' \) \
  -exec sed -i "s|/__VMS_BASE_PATH__/|${PUBLIC_URL}|g" {} +

json_string() {
  printf '"%s"' "$(printf '%s' "$1" | sed 's/[\\"]/\\&/g')"
}

# Read by src/const.ts
cat > /app/www/config.js <<CONFIG
window.__VMS_CONFIG__ = {
  mode: $(json_string "${MODE:-production}"),
  telegramBotHandle: $(json_string "${TELEGRAM_BOT_HANDLE:-}"),
  telegramBotOrigin: $(json_string "${TELEGRAM_BOT_ORIGIN:-}"),
};
CONFIG
