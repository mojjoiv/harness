<?php

declare(strict_types=1);

namespace PayHarness;

use InvalidArgumentException;

final class Webhook
{
    public const TOLERANCE_SECONDS = 300;

    public static function sign(string $secret, int $timestamp, string $rawBody): string
    {
        $key = hash('sha256', $secret, true);
        $digest = hash_hmac('sha256', $timestamp . '.' . $rawBody, $key);
        return 't=' . $timestamp . ',v1=' . $digest;
    }

    public static function verify(
        string $secret,
        string $signatureHeader,
        string $rawBody,
        ?int $nowSeconds = null,
        int $toleranceSeconds = self::TOLERANCE_SECONDS,
    ): bool {
        if (!preg_match('/^t=(\d+),v1=([a-f0-9]{64})$/', trim($signatureHeader), $matches)) {
            return false;
        }

        $timestamp = (int) $matches[1];
        $now = $nowSeconds ?? time();
        if (abs($now - $timestamp) > $toleranceSeconds) {
            return false;
        }

        $expected = self::sign($secret, $timestamp, $rawBody);
        $expectedDigest = substr($expected, strpos($expected, ',v1=') + 4);
        return hash_equals($expectedDigest, $matches[2]);
    }

    private function __construct()
    {
        throw new InvalidArgumentException('Webhook is a static helper.');
    }
}
