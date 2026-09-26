# PayHarness SDK Guide

Version: 0.1.0

PayHarness maintains official SDKs for Node.js/TypeScript, Go, PHP, and Python. They are currently maintained in the monorepo while the public API contract stabilizes.

## Common rules

All SDKs:
- use server-side PayHarness API keys;
- send `Authorization: Bearer ...`;
- support the unified payment and payout lifecycle exposed by the API;
- expose webhook signature verification;
- use the PayHarness five-minute replay tolerance;
- should preserve the PayHarness request ID for support/reconciliation;
- must never expose live API keys in browser or mobile client code.

Use `ph_sandbox_` keys during integration testing and `ph_live_` only in production.

## Node.js / TypeScript

Package: `@payharness/sdk-js`

```bash
npm --workspace packages/sdk-js run build
npm --workspace packages/sdk-js test
npm --workspace packages/sdk-js run pack:check
```

Example:

```ts
import { PayHarnessClient } from '@payharness/sdk-js';

const client = new PayHarnessClient({
  apiKey: process.env.PAYHARNESS_API_KEY!,
  baseUrl: process.env.PAYHARNESS_API_URL,
});

const result = await client.payments.create(
  {
    amountCents: 1500,
    currency: 'KES',
    environment: 'SANDBOX',
    provider: 'MPESA',
    metadata: { orderId: 'order-123' },
  },
  'order-123-payment',
);
```

Resources:
- payments.create
- payments.get
- payments.query
- payments.refund
- refunds.create
- payouts.create
- payouts.get
- payouts.list
- payouts.execute

## Go

Module: `github.com/mojjoiv/harness/payharness/packages/sdk-go`

Requirements: Go 1.22+.

```bash
cd packages/sdk-go
go test ./...
go vet ./...
go build ./...
```

## PHP

Package: `payharness/sdk-php`

Requirements: PHP 8.1+ and cURL.

```bash
cd packages/sdk-php
composer validate --no-check-publish
php tests/ClientTest.php
php tests/WebhookTest.php
```

## Python

Package: `payharness`

Requirements: Python 3.9+.

```bash
cd packages/sdk-python
python3 -m compileall payharness tests
python3 -m pytest -q
```

## Webhook verification

Verify the raw request body before applying payment state changes.

Canonical format:

```text
t=<unix timestamp>,v1=<hex digest>
```

Signing algorithm:

```text
HMAC-SHA256(SHA256(webhook_secret), "<timestamp>.<raw_body>")
```

Reject signatures outside the five-minute replay window and use constant-time comparison.

## Versioning and publishing

The current API contract is v0.1.0. SDK releases follow the API contract and should not silently change payment semantics. Integrations should pin SDK versions in production and test upgrades against sandbox before deployment.

The SDK source, package metadata, examples, and tests are kept together in this repository. Public package publishing is a release operation and should happen only after the corresponding API version and release artifacts have been reviewed.
