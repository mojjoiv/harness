FROM node:22.23.3-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/dashboard/package*.json ./apps/dashboard/
COPY packages/sdk-js/package*.json ./packages/sdk-js/
COPY packages/shared-types/package*.json ./packages/shared-types/
RUN npm ci

COPY apps/api ./apps/api
RUN npm --workspace apps/api run build
RUN npm prune --omit=dev

FROM debian:bookworm-slim AS runtime
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get upgrade -y \
  && apt-get install -y --no-install-recommends ca-certificates libgcc-s1 libstdc++6 openssl zlib1g \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/sh --create-home node

COPY --from=build /usr/local/bin/node /usr/local/bin/node

WORKDIR /app

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/apps/api/package*.json ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma

WORKDIR /app/apps/api
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health/readiness').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "dist/main.js"]
