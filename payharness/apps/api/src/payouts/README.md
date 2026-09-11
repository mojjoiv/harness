# Payouts

The payout module provides the unified payout domain and merchant-scoped API foundation.

Current lifecycle: `PENDING` → `PROCESSING` → `SUCCEEDED` or `FAILED`.

Provider execution is intentionally deferred to the next payout milestone. The current implementation persists requests, enforces merchant isolation, and guarantees idempotent creation per merchant and environment.
