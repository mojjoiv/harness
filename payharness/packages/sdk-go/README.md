# PayHarness Go SDK

Official Go SDK for the PayHarness payment API.

## Requirements

Go 1.22+

## Usage

```go
client := payharness.NewClient("ph_live_...")

payment, err := client.CreatePayment(map[string]any{
    "amountCents": 2500,
    "currency": "KES",
    "provider": "MPESA",
    "reference": "order-1001",
}, &payharness.RequestOptions{IdempotencyKey: "order-1001"})
```

API keys are server-side credentials. Never expose them in browser code.

## Resources

- `CreatePayment`
- `GetPayment`
- `QueryPayment`
- `CreateRefund`
- `CreatePayout`
- `GetPayout`
- `ListPayouts`
- `ExecutePayout`

## Webhooks

```go
valid := payharness.VerifyWebhookSignature(
    secret,
    signatureHeader,
    rawBody,
    time.Now(),
)
```

Signatures use `t=<timestamp>,v1=<digest>`, a SHA-256-derived signing key, HMAC-SHA256, constant-time comparison, and a five-minute replay tolerance.

## Development

```bash
go test ./...
go vet ./...
go build ./...
```

The SDK remains in the monorepo while the public API contract stabilizes.
