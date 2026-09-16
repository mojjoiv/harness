<?php

defined('ABSPATH') || exit;

class PayHarness_Webhook {
    public static function verify_signature($secret, $header, $body, $now = null) {
        if (!is_string($secret) || $secret === '' || !is_string($header) || !is_string($body)) {
            return false;
        }

        if (!preg_match('/(?:^|,)t=([0-9]+)(?:,|$)/', $header, $timestamp_match)) {
            return false;
        }

        if (!preg_match('/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/', $header, $signature_match)) {
            return false;
        }

        $timestamp = (int) $timestamp_match[1];
        $current_time = $now === null ? time() : (int) $now;
        if (abs($current_time - $timestamp) > 300) {
            return false;
        }

        $derived_key = hash('sha256', $secret);
        $expected = hash_hmac('sha256', $timestamp . '.' . $body, $derived_key);
        return hash_equals($expected, $signature_match[1]);
    }

    public static function event_fingerprint($event_type, $body) {
        return hash('sha256', (string) $event_type . "\n" . (string) $body);
    }
}
