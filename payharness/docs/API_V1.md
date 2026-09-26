# PayHarness API v1

PayHarness API v1 provides a stable, versioned server-to-server surface while preserving the existing unversioned routes for backwards compatibility.

## Base URL

Production:
- `https://harness-m6qs.onrender.com/api/v1`

For a merchant deployment, use the API base URL supplied by the merchant environment.

## Authentication

Use a PayHarness API key in the Authorization header:

```text
Authorization: Bearer ph_sandbox_...
```

API keys are environment-bound. Sandbox keys can only access sandbox operations and live keys can only access live operations.

## Payments

### Create
`POST /payments`

Accepts the existing validated payment request and routes to the configured provider.

### Retrieve
`GET /payments/:id`

### Query provider status
`GET /payments/:id/query`

### Refund
`POST /payments/:id/refund`

Refunds require OWNER or ADMIN authorization.

## Hosted checkout

### Create checkout session
`POST /checkout-sessions`

### Retrieve checkout session
`GET /checkout-sessions/:id`

### List checkout sessions
`GET /checkout-sessions`

## Request safety

- Send an `Idempotency-Key` for payment creation and refund operations.
- Never expose live API keys in browser or mobile client code.
- Use HTTPS in production.
- Validate webhook signatures before treating provider events as payment state changes.

## Compatibility

The original unversioned endpoints remain available so existing integrations are not broken during the v1 rollout. New integrations should use `/api/v1`.
