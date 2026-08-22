# Contributing to PayHarness

## Development workflow

1. Start from an up-to-date `main` branch.
2. Create a focused branch for one feature or fix.
3. Keep production changes and their tests in the same focused change.
4. Run the local quality checks before opening a pull request.
5. Open a pull request against `main` and wait for CI to pass.
6. Merge only after review and green CI.

Example:

```bash
git checkout main
git pull --ff-only origin main
git checkout -b feat/my-change
npm ci
```

## Quality checks

From `payharness/`:

```bash
npm run typecheck
npm run lint
npm test
npm run test:cov
npm run format:check
npm audit --audit-level=high
```

CI also runs Gitleaks secret scanning. Never commit API keys, passwords, tokens, populated `.env` files, or decrypted provider credentials.

## Tests

Add tests with behavior changes. Prefer focused unit tests for services, guards, utilities, and provider integrations. Payment and webhook changes should include regression coverage for success, failure, and idempotency paths where applicable.

## Environment

Copy `apps/api/.env.example` to `apps/api/.env` for local development. Use test/sandbox credentials only. Do not place real production credentials in source code, test fixtures, logs, or pull requests.

## Commits

Use small, descriptive commits. Avoid mixing unrelated formatting, refactoring, and feature work in the same commit.
