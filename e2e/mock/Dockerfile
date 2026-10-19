ARG NODE_VERSION="22.19"

FROM node:${NODE_VERSION}-alpine

WORKDIR /app
COPY server.mjs ./

ENV E2E_MOCK_HOST=0.0.0.0 \
    E2E_MOCK_PORT=8099

EXPOSE 8099

CMD ["node", "server.mjs"]
