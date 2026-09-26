# Provider Certification

## Scope

This is PayHarness's internal provider certification gate. It verifies that each supported provider is represented in the provider registry, has a registered payment adapter, has a credential-verification path, and is covered by the documented capability matrix.

This is an internal integration certification. It does **not** claim that PayHarness has completed an external certification, commercial onboarding, or production approval with a payment provider.

## Certified provider matrix

| Provider | Sandbox | Live | Refund | Query | Adapter |
|---|---:|---:|---:|---:|---:|
| M-Pesa | Yes | Yes | No | Yes | Registered |
| Stripe | Yes | Yes | Yes | Yes | Registered |
| PayPal | Yes | No | Yes | Yes | Registered |
| Pesapal | Yes | Yes | No | Yes | Registered |
| Flutterwave | Yes | Yes | No | Yes | Registered |

PayPal live processing is intentionally disabled in the current provider registry and must not be represented as live-ready.

## Certification checks

CI runs:

```bash
npm run verify:providers
```

The certification checks:
1. All five supported providers exist in the registry.
2. Every provider has a corresponding payment adapter.
3. Every adapter exposes create and query operations.
4. Provider definitions declare sandbox/live/refund/query capabilities.
5. Credential verification code exists for each provider.
6. Webhook routing exists for each provider.
7. The public API documentation matches the registered capability matrix.

## Live certification checklist

Before enabling live processing for a provider, the operator should complete the provider's own onboarding/certification requirements, verify live credentials, perform a controlled test transaction, verify callbacks/webhooks, verify reconciliation, and record the provider's production approval/reference in the operational change record.

No provider should be marked live-ready merely because the adapter passes static certification.
