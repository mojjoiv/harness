<?php

defined('ABSPATH') || exit;

class PayHarness_API {
    private $base_url;
    private $api_key;

    public function __construct($base_url, $api_key) {
        $this->base_url = rtrim((string) $base_url, '/');
        $this->api_key = trim((string) $api_key);
    }

    public function create_payment($payload, $idempotency_key) {
        return $this->request('POST', '/payments', $payload, ['Idempotency-Key' => $idempotency_key]);
    }

    public function query_payment($payment_id) {
        return $this->request('GET', '/payments/' . rawurlencode($payment_id) . '/query');
    }

    public function refund_payment($payment_id, $amount_cents, $idempotency_key) {
        $payload = [];
        if ($amount_cents !== null) {
            $payload['amountCents'] = (int) $amount_cents;
        }

        return $this->request(
            'POST',
            '/payments/' . rawurlencode($payment_id) . '/refund',
            $payload,
            ['Idempotency-Key' => $idempotency_key]
        );
    }

    private function request($method, $path, $body = null, $headers = []) {
        if (!$this->base_url || !$this->api_key) {
            return new WP_Error('payharness_not_configured', 'PayHarness API URL and API key are required.');
        }

        $request_headers = array_merge([
            'Authorization' => 'Bearer ' . $this->api_key,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'User-Agent' => 'PayHarness-WooCommerce/' . PAYHARNESS_WC_VERSION,
        ], $headers);

        $args = [
            'method' => $method,
            'timeout' => 30,
            'redirection' => 2,
            'headers' => $request_headers,
            'data_format' => 'body',
        ];
        if ($body !== null) {
            $args['body'] = wp_json_encode($body);
        }

        $response = wp_remote_request($this->base_url . $path, $args);
        if (is_wp_error($response)) {
            return $response;
        }

        $status = wp_remote_retrieve_response_code($response);
        $raw = wp_remote_retrieve_body($response);
        $decoded = json_decode($raw, true);

        if ($status < 200 || $status >= 300) {
            $message = 'PayHarness API request failed.';
            if (is_array($decoded)) {
                $message = $decoded['message'] ?? $decoded['error'] ?? $message;
            }
            return new WP_Error('payharness_api_error', $message, ['status' => $status, 'body' => $decoded]);
        }

        if (!is_array($decoded)) {
            return new WP_Error('payharness_invalid_response', 'PayHarness returned an invalid JSON response.');
        }

        return $decoded;
    }
}
