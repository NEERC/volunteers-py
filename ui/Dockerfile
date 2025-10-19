ARG NODE_VERSION="22.19"
ARG NGINX_VERSION="1.29"

FROM node:${NODE_VERSION}-alpine AS build

ARG PUBLIC_URL
ARG MODE
ARG VITE_TELEGRAM_BOT_HANDLE
ARG VITE_TELEGRAM_BOT_ORIGIN

ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app
COPY package.json pnpm-lock.yaml ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store  \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build --mode ${MODE} --base ${PUBLIC_URL}


FROM nginx:${NGINX_VERSION}-alpine

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /app/www

ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates \
    NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    PORT=8000

CMD ["nginx", "-g", "daemon off;"]
