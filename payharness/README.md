# PayHarness

Payment aggregator SaaS monorepo for the backend MVP.

## Structure

- `apps/api` - NestJS API with Prisma and PostgreSQL
- `apps/dashboard` - Next.js merchant/platform dashboard
- `packages/sdk-js` - JavaScript SDK package
- `packages/sdk-go` - Go SDK
- `packages/sdk-php` - PHP SDK
- `packages/sdk-python` - Python SDK
- `packages/shared-types` - shared TypeScript types
- `docs` - API, SDK, support, security, legal, deployment, and certification documentation

## Commercial-readiness documentation

- `docs/API_REFERENCE.md` - complete merchant API integration reference
- `docs/API_V1.md` - versioned API overview
- `docs/SDK_GUIDE.md` - official SDK usage and release guidance
- `docs/webhook-signatures.md` - webhook verification contract
- `docs/PROVIDER_CERTIFICATION.md` - provider capability and certification gate
- `docs/SUPPORT.md` - support and incident workflow
- `docs/COMMERCIAL_READINESS.md` - Phase 6 items 37–42

Public operational pages:
- `/status` - PayHarness-controlled service status
- `/terms` - terms draft
- `/privacy` - privacy notice draft
- `/security` - security statement

The legal pages are product drafts and require operator/legal approval before being treated as binding policies.

## Requirements

- Node.js `>=20.11.1`
- npm
- Docker Desktop / Docker Engine with Compose v2
- PostgreSQL for non-Docker local development

## Fresh-clone verification

After cloning:

```bash
cd payharness
npm ci
npm run verify:fresh-clone
```

## Local setup

```bash
cp .env.example .env
docker compose up --build
```

The API is available at `http://localhost:3000` and the dashboard at `http://localhost:3001`.

## Verification

Run the same quality checks used by CI:

```bash
npm run typecheck
npm run lint
npm test
npm run test:cov
npm run format:check
npm audit --audit-level=high
npm run verify:integrations
npm run verify:providers
```

Swagger is available at `/docs` when enabled for the environment. The public status payload is available at `/status`.

## API response format

Successful API responses, except health/status endpoints, are wrapped as:

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
  "message": "Readable error message",
  "errors": [],
  "timestamp": "2026-07-06T00:00:00.000Z"
}
```

See `docs/API_REFERENCE.md` for the integration contract and security guidance.

## Render deployment

Use `payharness/render.yaml` as the canonical Render blueprint. Keep production secrets in Render environment configuration.

## Pull requests and CI

Create focused branches from `main` and open a pull request against `main`. CI runs typechecking, linting, tests, audits, SDK validation, integration certification, provider certification, and infrastructure certification. Do not merge a PR with a failing quality or security check.
