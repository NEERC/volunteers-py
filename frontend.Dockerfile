ARG NODE_VERSION="22.19"
ARG NGINX_VERSION="1.29"

FROM node:${NODE_VERSION}-alpine AS build

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY ui /app
WORKDIR /app

RUN --mount=type=cache,id=pnpm,target=/pnpm/store  \
    pnpm install --frozen-lockfile

RUN pnpm run build


FROM nginx:${NGINX_VERSION}-alpine

RUN adduser -D -H -u 1001 -s /sbin/nologin webuser

COPY nginx/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /app/www

RUN chown -R webuser:webuser /app/www && \
    chown -R 755 /app/www && \
    chown -R webuser:webuser /var/cache/nginx && \
    chown -R webuser:webuser /var/log/nginx && \
    chown -R webuser:webuser /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R webuser:webuser /var/run/nginx.pid && \
    chmod -R 777 /etc/nginx/conf.d

ENV NGINX_ENVSUBST_TEMPLATE_DIR=/etc/nginx/templates \
    NGINX_ENVSUBST_TEMPLATE_SUFFIX=.template \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d \
    PORT=80

EXPOSE $PORT

USER webuser

CMD ["nginx", "-g", "daemon off;"]
