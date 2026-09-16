# Final Production Certification

This checklist is the release gate for PayHarness production readiness.

## Automated gates

Run from `payharness/`:

```bash
npm run verify:fresh-clone
npm run verify:integrations
npm run verify:woocommerce
npm run verify:joomla
npm run verify:security
npm run verify:disaster-recovery
npm run verify:production
npm run build
npm run typecheck
npm test --workspaces --if-present
npm run lint
npm run format:check
npm audit --audit-level=high
```

All commands must pass in CI before production certification.

## Production configuration

- Use managed PostgreSQL with automated backups and point-in-time recovery where available.
- Set `NODE_ENV=production`.
- Configure strong `JWT_SECRET` and `CREDENTIAL_ENCRYPTION_KEY` values through the deployment secret manager.
- Configure production `DATABASE_URL`; never commit credentials.
- Configure production frontend/API URLs and HTTPS-only origins.
- Keep Swagger disabled unless explicitly enabled for a controlled production debugging window.
- Configure provider credentials only through the merchant/platform credential flows.
- Keep sandbox and live API keys/environment boundaries isolated.
- Configure webhook secrets and verify signed webhook delivery.
- Configure rate limits and request telemetry appropriate for production traffic.

## Release procedure

1. Confirm the release commit is the exact commit tested by CI.
2. Confirm all required CI checks are green.
3. Confirm database migrations have been reviewed and are backward-compatible with the deployment sequence.
4. Confirm backups and restore procedures have been exercised successfully.
5. Deploy the API and dashboard from the certified commit.
6. Run authenticated health checks and a sandbox payment smoke test.
7. Verify webhook delivery and idempotent replay behavior.
8. Verify dashboard authentication and merchant isolation.
9. Verify production logs contain request correlation/telemetry without secrets or payment credentials.
10. Enable live processing only after the release checklist is signed off.

## Post-release checks

- Confirm API health and error rates.
- Confirm database connectivity and migration state.
- Confirm webhook delivery success and retry queues.
- Confirm provider connectivity.
- Confirm no secret values appear in logs.
- Confirm backup jobs remain scheduled and recent.
- Record deployment commit SHA and release timestamp.

## Rollback

If a release must be rolled back:

1. Stop further rollout.
2. Revert application traffic to the last certified release.
3. Preserve logs and telemetry for the incident window.
4. Do not blindly roll back database migrations; use a forward-compatible remediation or restore procedure when required.
5. Verify payment/webhook idempotency after rollback.
6. Re-run the production certification gates before the next release.

## Certification rule

A release is production-certified only when automated CI gates are green and the operational checklist above has been completed. This document does not authorize a deployment by itself; deployment remains subject to the configured production change-control process.
