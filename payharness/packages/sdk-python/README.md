# PayHarness Python SDK

Official Python SDK for the PayHarness payment API.

## Requirements

Python 3.9+

## Usage

```python
from payharness import PayHarnessClient

client = PayHarnessClient("ph_live_...")

payment = client.create_payment(
    {
        "amountCents": 2500,
        "currency": "KES",
        "provider": "MPESA",
        "reference": "order-1001",
    },
    idempotency_key="order-1001",
)
```

API keys are server-side credentials. Never expose them in browser code.

## Resources

- `create_payment()`
- `get_payment()`
- `query_payment()`
- `create_refund()`
- `create_payout()`
- `get_payout()`
- `list_payouts()`
- `execute_payout()`

## Webhooks

```python
from payharness import verify_webhook_signature

if not verify_webhook_signature(secret, signature_header, raw_body):
    raise ValueError("Invalid webhook signature")
```

Signatures use `t=<timestamp>,v1=<digest>`, SHA-256-derived signing keys, HMAC-SHA256, constant-time comparison, and a five-minute replay tolerance.

## Development

```bash
python -m pytest -q
python -m compileall payharness tests
python -m build --wheel
```

The package remains in the monorepo while the public API contract stabilizes and is intended to be publish-ready for PyPI.
