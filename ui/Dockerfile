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

ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates \
    NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    PORT=8000

# Commit the image is built from, shown in the menu. Set after the build of the app,
# so a new commit doesn't invalidate its cache
ARG GIT_COMMIT=
ENV GIT_COMMIT=${GIT_COMMIT}

# Configuration of the deployment applied on start, see docker-entrypoint.sh
ENV PUBLIC_URL=/ \
    MODE=production \
    TELEGRAM_BOT_HANDLE= \
    TELEGRAM_BOT_ORIGIN=

CMD ["nginx", "-g", "daemon off;"]
