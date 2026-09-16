FROM node:20.11.1-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci

COPY apps/api ./apps/api
COPY integrations ./integrations
RUN npm --workspace apps/api run build

FROM node:20.11.1-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/api/package*.json ./apps/api/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/integrations ./integrations

WORKDIR /app/apps/api
EXPOSE 3000
CMD ["node", "dist/main.js"]
