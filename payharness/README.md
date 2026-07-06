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

## Render Deployment

Use `apps/api/render.yaml` or create a Render Node service manually.

- Runtime: Node
- Build Command: `npm install && npm run build`
- Start Command: `npm run start:prod`
- `NODE_VERSION=16.20.2`
- `DATABASE_URL=<Render PostgreSQL URL>`
- `JWT_SECRET=<strong secret>`
- `JWT_EXPIRES_IN=7d`
- `CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>`
- `APP_URL=https://your-api.onrender.com`
- `CHECKOUT_URL=https://your-checkout-app.example`

No Docker setup is required.

## MVP Notes

Provider integrations are mocked in this version. M-Pesa, Stripe, and PayPal payment endpoints create local `payments` and `transactions` records and return fake provider references and next actions.
