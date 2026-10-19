ARG NODE_VERSION="22.19"
ARG NGINX_VERSION="1.29"

FROM node:${NODE_VERSION}-alpine AS build

ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store  \
    pnpm install --frozen-lockfile

COPY . .

# The base path is a placeholder replaced on container start, see docker-entrypoint.sh
RUN pnpm run build --base /__VMS_BASE_PATH__/


FROM nginx:${NGINX_VERSION}-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY docker-entrypoint.sh /docker-entrypoint.d/40-vms-runtime-config.sh
COPY --from=build /app/dist /app/www

# Defaults of the configuration applied on start (docker-entrypoint.sh): deployments set
# these variables, the build args only keep docker-compose-prod.yaml working
ARG PUBLIC_URL=/
ARG MODE=production
ARG VITE_TELEGRAM_BOT_HANDLE=
ARG VITE_TELEGRAM_BOT_ORIGIN=

ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates \
    NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    PORT=8000 \
    PUBLIC_URL=${PUBLIC_URL} \
    MODE=${MODE} \
    TELEGRAM_BOT_HANDLE=${VITE_TELEGRAM_BOT_HANDLE} \
    TELEGRAM_BOT_ORIGIN=${VITE_TELEGRAM_BOT_ORIGIN}

CMD ["nginx", "-g", "daemon off;"]
