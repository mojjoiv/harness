# Harness

## Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL

## Project structure

- `payharness/apps/api` — NestJS API
- `payharness/apps/dashboard` — dashboard application

## Setup

```bash
cd payharness
npm install
```

Copy `.env.example` to `.env` and fill in the required values.

## Development

API:

```bash
cd apps/api
npm run start:dev
```

Dashboard:

```bash
cd apps/dashboard
npm run dev
```

## Tests

From `payharness/apps/api`:

```bash
npm test
npm run test:cov
```

## Quality checks

```bash
npm run lint
npx tsc --noEmit
npm audit --audit-level=high
```

Never commit real credentials or decrypted payment-provider secrets.
