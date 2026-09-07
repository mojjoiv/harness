# PayPal E2E flow

PayPal order creation is intentionally provider-specific. The PayPal adapter returns `orderId`, `status`, and `approvalUrl`; the payment service must map `orderId` to `providerReference` and return the approval URL rather than routing the call through the generic `process()` adapter contract.

E2E target: create PayPal Sandbox order -> approve in PayPal Sandbox -> capture -> verify resulting PayPal status and PayHarness payment state. No credentials belong in source control.
