# PayPal Sandbox E2E

This phase must use real PayPal Sandbox APIs, never simulated outcomes or mock provider responses.

Required flow: create PayPal Order (CAPTURE) -> payer approval -> capture -> verify resulting PayPal order/capture state -> settle PayHarness payment.

Reference: https://developer.paypal.com/api/rest/integration/orders-api
