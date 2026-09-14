# PayHarness PHP SDK

Official PHP SDK for the PayHarness payment API.

## Requirements

- PHP 8.1+
- cURL extension

## Usage

```php
use PayHarness\Client;

$client = new Client($_ENV['PAYHARNESS_API_KEY']);

$payment = $client->createPayment([
    'amountCents' => 2500,
    'currency' => 'KES',
    'provider' => 'MPESA',
    'reference' => 'order-1001',
], 'order-1001');
```

The SDK uses server-side API keys and sends them as `Authorization: Bearer ...`. Never expose a PayHarness secret key in browser code.

## Resources

- `createPayment()`
- `getPayment()`
- `queryPayment()`
- `createRefund()`
- `createPayout()`
- `getPayout()`
- `listPayouts()`
- `executePayout()`

Write operations accept an optional idempotency key.

## Webhook verification

```php
use PayHarness\Webhook;

$signature = $_SERVER['HTTP_X_PAYHARNESS_SIGNATURE'] ?? '';
$rawBody = file_get_contents('php://input');

if (!Webhook::verify($_ENV['PAYHARNESS_WEBHOOK_SECRET'], $signature, $rawBody)) {
    http_response_code(400);
    exit;
}
```

Signatures use the PayHarness `t=<timestamp>,v1=<digest>` format with a five-minute replay tolerance and constant-time digest comparison.

## Errors

Non-2xx API responses throw `PayHarnessException`, exposing `status`, `requestId`, and `details`.

## Development

```bash
composer validate --no-check-publish
php -l src/Client.php
php -l src/PayHarnessException.php
php -l src/Webhook.php
php tests/ClientTest.php
php tests/WebhookTest.php
```

The package is kept in the monorepo while the PayHarness public API contract stabilizes and is intended to be publish-ready through Composer.
