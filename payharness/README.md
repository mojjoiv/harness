# PayHarness

Payment aggregator SaaS monorepo for the first MVP.

## Structure

- `apps/api` - NestJS 10 API
- `packages/sdk-js` - placeholder JavaScript SDK package
- `packages/shared-types` - shared TypeScript types
- `docs` - API and deployment notes

## Local Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate
npm --workspace apps/api run seed
npm run build
npm --workspace apps/api run start:dev
```

Use a PostgreSQL database and set `DATABASE_URL` before running migrations.

## Render Deployment

Use the included `apps/api/render.yaml` blueprint or create a Node service manually:

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:prod`
- `NODE_VERSION=16.20.2`
- `DATABASE_URL=<Render PostgreSQL URL>`
- `JWT_SECRET=<strong secret>`
- `CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32 byte key>`

No Docker setup is required.
