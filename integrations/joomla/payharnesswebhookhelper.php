<?php
defined('_JEXEC') or die;

class PayHarnessJoomlaWebhook
{
    public static function verifySignature($secret, $header, $body, $now = null)
    {
        if (!preg_match('/(?:^|,)t=([0-9]+)(?:,|$)/', (string) $header, $timestamp_match)) return false;
        if (!preg_match('/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/', (string) $header, $signature_match)) return false;

        $timestamp = (int) $timestamp_match[1];
        $current_time = $now === null ? time() : (int) $now;
        if (abs($current_time - $timestamp) > 300) return false;

        $secret = trim((string) $secret);
        if ($secret === '') return false;

        $key = hash('sha256', $secret);
        $expected = hash_hmac('sha256', $timestamp . '.' . (string) $body, $key);
        return hash_equals($expected, strtolower($signature_match[1]));
    }

    public static function fingerprint($event_type, $body)
    {
        return hash('sha256', (string) $event_type . "\n" . (string) $body);
    }
}
