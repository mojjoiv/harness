<?php

declare(strict_types=1);

use PayHarness\Client;
use PayHarness\PayHarnessException;

spl_autoload_register(static function (string $class): void {
    $prefix = 'PayHarness\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $path = dirname(__DIR__) . '/src/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    require $path;
});

$captured = null;
$client = new Client('ph_sandbox_test', 'https://example.test', static function (string $method, string $url, array $headers, ?string $body) use (&$captured): array {
    $captured = [$method, $url, $headers, $body];
    return ['status' => 200, 'body' => '{"success":true,"data":{"id":"pay_123"}}'];
});

$result = $client->createPayment(['amountCents' => 1000, 'provider' => 'MPESA'], 'payment-test-1');

if ($result['success'] !== true || $captured === null) {
    throw new RuntimeException('Payment request failed.');
}
if ($captured[0] !== 'POST' || $captured[1] !== 'https://example.test/payments') {
    throw new RuntimeException('Payment request method or URL is invalid.');
}
if (!in_array('Authorization: Bearer ph_sandbox_test', $captured[2], true)) {
    throw new RuntimeException('API key authorization header is missing.');
}
if (!in_array('Idempotency-Key: payment-test-1', $captured[2], true)) {
    throw new RuntimeException('Idempotency header is missing.');
}

$errorClient = new Client('ph_sandbox_test', 'https://example.test', static function (): array {
    return ['status' => 409, 'body' => '{"message":"duplicate payment","code":"IDEMPOTENCY_CONFLICT"}'];
});

try {
    $errorClient->createPayment(['amountCents' => 1000]);
    throw new RuntimeException('Expected PayHarnessException was not thrown.');
} catch (PayHarnessException $exception) {
    if ($exception->status !== 409 || $exception->details['code'] !== 'IDEMPOTENCY_CONFLICT') {
        throw new RuntimeException('Structured PayHarnessException is incomplete.');
    }
}

echo "Client tests passed.\n";
