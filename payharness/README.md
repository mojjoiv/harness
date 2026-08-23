# PayHarness

Payment aggregator SaaS monorepo for the backend MVP.

## Structure

- `apps/api` - NestJS API with Prisma and PostgreSQL
- `apps/dashboard` - Next.js merchant/platform dashboard
- `packages/sdk-js` - JavaScript SDK package
- `packages/shared-types` - shared TypeScript types
- `docs` - API and deployment notes

## Requirements

- Node.js `>=20.11.1` (matches the root `package.json` engine requirement)
- npm
- PostgreSQL (local or hosted, such as Neon)

Check your versions before installing:

```bash
node --version
npm --version
```

## Local Setup

Install dependencies from the monorepo root. The root lockfile covers the workspaces, so use `npm ci` for a reproducible fresh clone:

```bash
cd payharness
npm ci
```

Create the root environment file:

```bash
cp .env.example .env
```

Set the required values in `.env`. At minimum:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/payharness
JWT_SECRET=<strong random secret>
CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>
SUPERADMIN_EMAIL=admin@example.com
SUPERADMIN_PASSWORD=<strong password>
SUPERADMIN_NAME=Platform Admin
```

Generate an encryption key with:

```bash
openssl rand -base64 32
```

The root `.env.example` documents the environment used by the API and dashboard. Never commit a populated `.env` file or real provider credentials.

### Docker Compose

Docker Compose uses the same root `.env` file, so a fresh clone only needs one environment file:

```bash
cp .env.example .env
docker compose up --build
```

The API is available at `http://localhost:3000` and the dashboard at `http://localhost:3001`.

To stop the stack:

```bash
docker compose down
```

The Compose configuration does not contain application secrets. Keep real credentials in the local `.env` file or your deployment platform's secret/environment configuration.

### Prepare Prisma

For local development:

```bash
npm --workspace apps/api run prisma:generate
npm --workspace apps/api run prisma:migrate
npm --workspace apps/api run seed
```

Create a new migration when the Prisma schema changes:

```bash
npm --workspace apps/api run prisma:migrate
```

Deployment uses committed migrations only:

```bash
npm run db:setup
```

`db:setup` runs `prisma generate`, `prisma migrate deploy`, and the seed script. Do not use `prisma db push` for PayHarness deployments.

## Development

Start the API:

```bash
npm --workspace apps/api run start:dev
```

Start the dashboard in a second terminal:

```bash
npm --workspace apps/dashboard run dev
```

The API listens on `http://localhost:3000` by default and the dashboard on `http://localhost:3001`.

Build everything:

```bash
npm run build
```

## Verification

Run the same quality checks used by CI before opening a PR:

```bash
npm run typecheck
npm run lint
npm test
npm run test:cov
npm run format:check
npm audit --audit-level=high
```

For a quick API smoke test after starting the API:

```bash
curl http://localhost:3000/health
```

Swagger API documentation is available at:

```text
http://localhost:3000/docs
```

## Architecture

PayHarness is split into a platform layer and merchant layer:

```text
Platform
  ↓ owns
Merchants
  ↓ contain
Merchant Users
```

Platform users are stored in `PlatformUser` and authenticate through `/platform/auth/login`. Merchant users are stored in `User`/`MerchantUser` records and authenticate through `/auth/login` or `/auth/register`.

JWTs are intentionally separated:

- Platform JWT: `userId`, `role`, `type=platform`
- Merchant JWT: `userId`, `merchantId`, `role`, `type=merchant`

Platform routes require platform JWTs. Merchant routes require merchant JWTs. API-key authentication is used for programmatic merchant access.

## Render Deployment

Use `payharness/render.yaml` as the canonical Render blueprint. The older `apps/api/render.yaml` is reference-only.

Backend settings:

- Runtime: Node
- Root Directory: `payharness`
- Build Command: `npm ci && npm run build:api`
- Start Command: `npm run db:setup && npm run start:prod`
- `NODE_VERSION=20.11.1`
- `NODE_ENV=production`
- `DATABASE_URL=<PostgreSQL connection string>`
- `JWT_SECRET=<strong secret>`
- `JWT_EXPIRES_IN=7d`
- `CREDENTIAL_ENCRYPTION_KEY=<base64 encoded 32-byte key>`
- `APP_URL=<public API URL>`
- `CHECKOUT_URL=<checkout URL>`
- `FRONTEND_URL=<dashboard URL>`
- `SUPERADMIN_EMAIL=<platform superadmin email>`
- `SUPERADMIN_PASSWORD=<platform superadmin password>`
- `SUPERADMIN_NAME=<platform superadmin name>`

Frontend settings:

- Root Directory: `payharness/apps/dashboard`
- Build Command: `npm install && npm run build`
- Start Command: `npm run start`
- `NODE_VERSION=20.11.1`
- `NEXT_PUBLIC_API_URL=<public API URL>`

After changing `NEXT_PUBLIC_API_URL`, redeploy the dashboard because Next.js embeds this value during its build.

## API Response Format

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

## Main API Areas

Merchant dashboard endpoints include:

- `GET/PATCH /merchant/profile`
- `GET/PATCH /merchant/branding`
- `GET/PATCH /merchant/settings`
- `GET /dashboard`
- `GET /analytics/*`
- `GET /providers/status`
- `GET /usage`
- `GET /audit-logs`
- `GET /transactions`
- `GET /checkout-sessions`
- `GET /webhooks/endpoints`

Platform endpoints include:

- `POST /platform/auth/login`
- `GET /platform/auth/profile`
- `GET /platform/dashboard`
- `GET /platform/merchants`
- `GET /platform/plans`
- `GET /platform/subscriptions`
- `GET /platform/users`

See Swagger at `/docs` for the complete current API contract.

## Pull Requests and CI

Create focused branches from `main` for changes and open a pull request against `main`. CI runs typechecking, linting, tests, dependency audit, and secret scanning. Do not merge a PR with a failing quality or security check.

For development conventions and the contribution workflow, see `CONTRIBUTING.md`.
