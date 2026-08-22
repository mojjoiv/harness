# Payment Idempotency

Implementation branch: `feat/payment-idempotency`

This branch reserves the payment-idempotency contract. Every merchant payment creation request must provide an idempotency key that is unique within the merchant and environment. Repeating the same key must return the original payment instead of executing the provider again.

## Safety contract

- Same merchant + environment + idempotency key => same payment.
- Different merchant or environment => independent payment.
- Provider execution must happen only after the idempotency record is claimed.
- Concurrent requests must be protected by a database uniqueness constraint.
- A retry must return the existing payment state rather than create a second provider request.
