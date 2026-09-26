# PayHarness Support Workflow

## Purpose

Support is an operational workflow for diagnosing merchant issues without requesting or exposing payment credentials.

## Required information

Ask the merchant for:
- merchant name;
- affected environment: sandbox or live;
- approximate incident time and timezone;
- PayHarness request ID;
- payment, payout, checkout-session, or webhook delivery ID when available;
- provider;
- HTTP status/code and safe error message;
- reproducible steps;
- whether the issue is ongoing or recovered.

Never ask for an API key, provider secret, webhook secret, password, or full authorization header.

## Severity

### SEV-1 — Critical

Use when production payment processing is broadly unavailable, financial state may be incorrect, or a confirmed security incident is suspected.

Actions:
1. Open an incident record immediately.
2. Preserve relevant audit/request IDs.
3. Check `/health`, `/health/readiness`, and `/status`.
4. Check recent deployments and provider verification failures.
5. Escalate to the platform owner.
6. Record mitigation and reconciliation actions.

### SEV-2 — Major

Use for a significant production integration failure affecting a merchant or material payment flow.

Actions:
1. Capture request/payment/webhook IDs.
2. Reproduce in sandbox where possible.
3. Check provider status and webhook delivery history.
4. Reconcile ambiguous payments before retrying.

### SEV-3 — Normal

Use for configuration questions, onboarding issues, documentation requests, and isolated non-blocking defects.

### SEV-4 — Informational

Use for feature requests, feedback, and general questions.

## Incident handling

For payment incidents:
1. Do not infer a payment outcome from a browser redirect.
2. Query the PayHarness payment record.
3. Inspect verified provider webhook deliveries.
4. Reconcile with the provider when the outcome remains ambiguous.
5. Preserve the audit trail.
6. Only then communicate the confirmed state to the merchant.

For security incidents, rotate compromised credentials and follow the incident-response procedure documented in the production security runbook.

## Closure

Every resolved incident should record:
- root cause or current best-known cause;
- affected environment/provider;
- start and recovery times;
- impacted resources;
- mitigation;
- reconciliation performed;
- follow-up action;
- customer communication status.

Internal response targets are operational goals, not contractual service guarantees unless separately agreed with a merchant.
