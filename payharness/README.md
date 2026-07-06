# PayHarness

Payment aggregator SaaS monorepo for the first backend MVP.

## Structure

- `apps/api` - NestJS 10 API with Prisma and PostgreSQL
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

Create API environment variables:

```bash
cp apps/api/.env.example apps/api/.env
```

Set at least:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/payharness
JWT_SECRET=replace-with-a-strong-secret
CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>
```

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

## Render Deployment

Use the root blueprint at `payharness/render.yaml`. The older `apps/api/render.yaml` is kept for reference, but new Render blueprint deploys should point at `payharness/render.yaml`.

- Runtime: Node
- Root Directory: `payharness`
- Build Command: `npm install && npm run build`
- Start Command: `npm run db:setup && npm run start:prod`
- `NODE_VERSION=16.20.2`
- `NODE_ENV=production`
- `DATABASE_URL=<Render PostgreSQL URL>`
- `JWT_SECRET=<strong secret>`
- `JWT_EXPIRES_IN=7d`
- `CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>`
- `APP_URL=https://your-api.onrender.com`
- `CHECKOUT_URL=https://your-checkout-app.example`

No Docker setup is required.

Run database migrations before or during deployment:

```bash
npm run prisma:migrate:deploy
```

For Render deploys, `db:setup` runs automatically before the API starts. It is acceptable for the MVP because it uses `prisma db push` plus seeding to align the schema quickly without forcing migration management during early iteration.

Later, once schema changes need tighter production control, switch deployment automation to `prisma migrate deploy` instead of `prisma db push`.

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

## MVP Notes

Provider integrations are mocked in this version. M-Pesa, Stripe, and PayPal payment endpoints create local `payments` and `transactions` records and return fake provider references and next actions.
