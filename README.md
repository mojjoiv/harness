# Harness

Harness (PayHarness) is a NestJS + Next.js payment platform monorepo.

## Architecture

- `payharness/apps/api` — NestJS API, Prisma and PostgreSQL
- `payharness/apps/dashboard` — Next.js merchant dashboard
- `payharness/apps/api/prisma` — database schema and migrations
- `.github/workflows/ci.yml` — CI quality and secret scanning

The API owns authentication, merchant/provider configuration, payment workflows and persistence. The dashboard consumes the API through `NEXT_PUBLIC_API_URL`.

## Prerequisites

For local development without containers:

- Node.js 20+
- npm 10+
- PostgreSQL 14+

For the full local stack, Docker Engine with Docker Compose is sufficient.

## Quickstart — Docker Compose

From a fresh clone:

```bash
git clone https://github.com/mojjoiv/harness.git
cd harness/payharness
cp .env.example .env
```

Set at least `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` in `.env`. For local development, non-production values are sufficient. Generate the encryption key with:

```bash
openssl rand -base64 32
```

Start PostgreSQL, the API and dashboard:

```bash
docker compose up --build
```

Once the services are healthy:

- Dashboard: http://localhost:3001
- API health: http://localhost:3000/
- API Swagger: http://localhost:3000/docs
- PostgreSQL: localhost:5432

Stop the stack with:

```bash
docker compose down
```

Add `-v` only when you intentionally want to remove the local PostgreSQL volume and its data.

## Local development

```bash
cd payharness
npm install
cp .env.example .env
npm run prisma:generate
```

Start the API:

```bash
npm --workspace apps/api run start:dev
```

Start the dashboard in another terminal:

```bash
npm --workspace apps/dashboard run dev
```

If using a host-installed PostgreSQL instance, set `DATABASE_URL` in `.env` to that database's PostgreSQL connection string.

## Database

Apply committed migrations:

```bash
npm run prisma:migrate:deploy
```

For a development database where migrations need to be created interactively:

```bash
npm --workspace apps/api run prisma:migrate
```

Seed development data when required:

```bash
npm run seed
```

## Tests

Run all workspace tests:

```bash
npm test
```

Run API tests with coverage:

```bash
npm run test:cov
```

Run dashboard tests:

```bash
npm run test:dashboard
```

Tests should use mocks/test doubles rather than real payment-provider accounts or live external APIs.

## Quality checks

The CI workflow runs quality checks on pushes to `main` and pull requests targeting `main`:

```bash
npm run prisma:generate
npm run typecheck
npm run lint
npm run format:check:changed
npm run test:cov
npm audit --audit-level=high
```

A separate CI job runs Gitleaks secret scanning. Never commit real credentials, decrypted payment-provider secrets, or a populated `.env` file.

## Environment variables

`.env.example` is the canonical list of local configuration keys. Important values include:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret |
| `CREDENTIAL_ENCRYPTION_KEY` | Base64-encoded 32-byte credential encryption key |
| `APP_URL` | Application URL used by callbacks |
| `FRONTEND_URL` | Dashboard origin allowed by the API |
| `NEXT_PUBLIC_API_URL` | API URL exposed to the dashboard |
| `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET` | Gmail API integration credentials |
| `GMAIL_REFRESH_TOKEN` | Gmail API refresh token |
| `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` | Development bootstrap credentials |
| `ENABLE_MPESA_SMOKE_TEST` | Optional M-Pesa smoke-test path |

Use production secret storage for deployed environments; do not put production credentials into `.env.example`.

## Repository workflow

Keep feature work small and test-backed. A behavior change should include its relevant `*.spec.ts` or `*.spec.tsx` coverage in the same focused change. Avoid mixing unrelated formatting, refactors and features in one commit.
