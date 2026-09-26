FROM node:22.23.3-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm install -g npm@11.19.1 && npm ci

COPY apps/api ./apps/api
RUN npm --workspace apps/api run build
RUN npm prune --omit=dev

FROM debian:bookworm-slim AS runtime
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libgcc-s1 libstdc++6 openssl zlib1g \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local/bin/node /usr/local/bin/node
RUN groupadd --gid 1000 node && useradd --uid 1000 --gid node --shell /bin/sh --create-home node

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/api/package*.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh

WORKDIR /app/apps/api
USER node
EXPOSE 3000
CMD ["./docker-entrypoint.sh"]
