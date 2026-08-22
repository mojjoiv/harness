FROM node:20.11.1-bookworm-slim AS build

WORKDIR /app
COPY package*.json ./
COPY apps/dashboard/package*.json ./apps/dashboard/
RUN npm ci

COPY apps/dashboard ./apps/dashboard
RUN npm --workspace apps/dashboard run build

FROM node:20.11.1-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/apps/dashboard/package*.json ./apps/dashboard/
COPY --from=build /app/apps/dashboard/.next ./apps/dashboard/.next

WORKDIR /app/apps/dashboard
ENV PORT=3001
EXPOSE 3001
CMD ["npm", "run", "start"]
