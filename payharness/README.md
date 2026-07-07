# PayHarness

Payment aggregator SaaS monorepo for the first backend MVP.

## Structure

- `apps/api` - NestJS 10 API with Prisma and PostgreSQL
- `apps/dashboard` - Next.js merchant dashboard plus separate platform dashboard
- `packages/sdk-js` - placeholder JavaScript SDK package
- `packages/shared-types` - shared TypeScript types
- `docs` - API and deployment notes

## Requirements

- Node.js `16.20.2`
- PostgreSQL
- npm

## Local Setup

Install dependencies from the monorepo root:

```bash
cd payharness
npm install
```

Run the dashboard locally:

```bash
npm --workspace apps/dashboard run dev
```

Create API environment variables:

```bash
cp apps/api/.env.example apps/api/.env
```

Set at least:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/payharness
JWT_SECRET=replace-with-a-strong-secret
CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=replace-with-a-strong-password
SUPERADMIN_NAME=Platform Admin
```

For Neon, use the PostgreSQL connection string from your Neon project and keep it in `DATABASE_URL`. The app expects a normal PostgreSQL URL and does not need Docker.

Generate an encryption key:

```bash
openssl rand -base64 32
```

Prepare Prisma:

```bash
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate
npm --workspace apps/api run seed
```

For the MVP deploy path, Render runs `db:setup` automatically before startup. That uses `prisma db push` plus seeding so the schema and default plans stay aligned without managing migrations in the deploy step.

Once the project needs stricter production control, switch deploy automation to `prisma migrate deploy` instead of `prisma db push`.

Start development server:

```bash
npm --workspace apps/api run start:dev
```

Build:

```bash
npm run build
```

Local smoke test flow:

```bash
npm --workspace apps/api run prisma:migrate
npm --workspace apps/api run start:dev
curl -X POST http://localhost:3000/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","name":"Owner","merchantName":"Demo Merchant","password":"password123"}'
curl -X POST http://localhost:3000/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"owner@example.com","password":"password123"}'
curl http://localhost:3000/dashboard -H "Authorization: Bearer <token>"
```

Platform login uses the separately seeded `PlatformUser` account:

```bash
curl -X POST http://localhost:3000/platform/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password123"}'
curl http://localhost:3000/platform/auth/profile -H "Authorization: Bearer <platform-token>"
```

## Architecture

PayHarness is split into a SaaS platform layer and merchant layer:

```text
Platform
  ↓ owns
Merchants
  ↓ contain
Merchant Users
```

Platform users are stored in `PlatformUser` and authenticate through `/platform/auth/login`. They represent PayHarness operators such as `SUPERADMIN`, `PLATFORM_ADMIN`, `SUPPORT`, `FINANCE`, and `COMPLIANCE`. A platform user never belongs to a merchant.

Merchant users are stored as `User` records attached to merchants through `MerchantUser`. Merchant roles are `OWNER`, `ADMIN`, `DEVELOPER`, and `VIEWER`. Merchant users authenticate through `/auth/login` or `/auth/register`.

JWTs are intentionally separated:

- Platform JWT: `userId`, `role`, `type=platform`
- Merchant JWT: `userId`, `merchantId`, `role`, `type=merchant`

Platform routes require platform JWTs. Merchant dashboard routes require merchant JWTs, so platform users cannot enter merchant dashboards and merchant users cannot enter platform routes.

## Render Deployment

Use the root blueprint at `payharness/render.yaml`. The older `apps/api/render.yaml` is kept for reference, but new Render blueprint deploys should point at `payharness/render.yaml`.

- Runtime: Node
- Root Directory: `payharness`
- Build Command: `npm install && npm run build:api`
- Start Command: `npm run db:setup && npm run start:prod`
- `NODE_VERSION=16.20.2`
- `NODE_ENV=production`
- `DATABASE_URL=<Render PostgreSQL URL>`
- `JWT_SECRET=<strong secret>`
- `JWT_EXPIRES_IN=7d`
- `CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>`
- `APP_URL=https://your-api.onrender.com`
- `CHECKOUT_URL=https://your-checkout-app.example`
- `FRONTEND_URL=<your frontend Render URL>`
- `SUPERADMIN_EMAIL=<platform superadmin email>`
- `SUPERADMIN_PASSWORD=<platform superadmin password>`
- `SUPERADMIN_NAME=<platform superadmin name>`

Frontend Render environment:

- `NODE_VERSION=16.20.2`
- `NEXT_PUBLIC_API_URL=https://harness-m6qs.onrender.com`

Backend Render environment:

- `FRONTEND_URL=<your frontend Render URL>`
- `APP_URL=https://harness-m6qs.onrender.com`
- `CHECKOUT_URL=<your frontend Render URL>`

After changing `NEXT_PUBLIC_API_URL` on Render, redeploy the frontend because Next.js bakes it in at build time.

No Docker setup is required.

Run database migrations before or during deployment:

```bash
npm run prisma:migrate:deploy
```

The root Render blueprint at [render.yaml](/workspaces/harness/payharness/render.yaml) is the one to use. The older [apps/api/render.yaml](/workspaces/harness/payharness/apps/api/render.yaml) is kept only for reference.

Smoke test steps are documented in [docs/smoke-test.md](/workspaces/harness/payharness/docs/smoke-test.md).

The dashboard can be deployed later as a separate Render web service using `apps/dashboard` as the root directory and `npm --workspace apps/dashboard run build` / `npm --workspace apps/dashboard run start`.

## API Docs

Swagger UI is available at:

```text
/docs
```

Successful API responses, except `/health`, are wrapped as:

```json
{
  "success": true,
  "data": {},
  "meta": {},
  "timestamp": "2026-07-06T00:00:00.000Z"
}
```

Errors use:

```json
{
  "success": false,
  "code": "BAD_REQUEST",
  "message": "Readable message",
  "errors": [],
  "timestamp": "2026-07-06T00:00:00.000Z"
}
```

## Merchant Dashboard Endpoints

All dashboard endpoints require `Authorization: Bearer <token>` and use the merchant ID from the JWT.

- `GET /merchant/profile`
- `PATCH /merchant/profile`
- `GET /merchant/branding`
- `PATCH /merchant/branding`
- `GET /merchant/settings`
- `PATCH /merchant/settings`
- `GET /dashboard`
- `GET /analytics/revenue?period=daily|weekly|monthly|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /analytics/providers?period=daily|weekly|monthly|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /analytics/payments?period=daily|weekly|monthly|custom&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /providers/status`
- `GET /usage?page=1&limit=20&method=GET&endpoint=/dashboard&from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /audit-logs?page=1&limit=20`

These existing list endpoints now support pagination with `page`, `limit`, `sort`, and `order`:

- `GET /transactions`
- `GET /checkout-sessions`
- `GET /webhooks/endpoints`
- `GET /usage`
- `GET /audit-logs`

## Platform Endpoints

Platform endpoints require `Authorization: Bearer <platform-token>`.

- `POST /platform/auth/login`
- `GET /platform/auth/profile`
- `GET /platform/dashboard`
- `GET /platform/merchants`
- `GET /platform/plans`
- `GET /platform/subscriptions`
- `GET /platform/users`

The platform dashboard lives at `/platform`. Merchant dashboard routes remain unchanged.

## MVP Notes

Provider integrations are mocked in this version. M-Pesa, Stripe, and PayPal payment endpoints create local `payments` and `transactions` records and return fake provider references and next actions.
