<?php

declare(strict_types=1);

use PayHarness\Webhook;

require dirname(__DIR__) . '/vendor/autoload.php';

$secret = 'whsec_test';
$body = '{"type":"payment.succeeded"}';
$timestamp = 1_700_000_000;
$signature = Webhook::sign($secret, $timestamp, $body);

if (!str_starts_with($signature, 't=')) {
    throw new RuntimeException('Webhook signature format is invalid.');
}

if (!Webhook::verify($secret, $signature, $body, $timestamp)) {
    throw new RuntimeException('Valid webhook signature was rejected.');
}

if (Webhook::verify($secret, $signature, '{"type":"payment.failed"}', $timestamp)) {
    throw new RuntimeException('Modified webhook body was accepted.');
}

if (Webhook::verify($secret, $signature, $body, $timestamp + 301)) {
    throw new RuntimeException('Stale webhook signature was accepted.');
}

if (Webhook::verify($secret, 'invalid', $body, $timestamp)) {
    throw new RuntimeException('Malformed webhook signature was accepted.');
}

echo "Webhook tests passed.\n";
