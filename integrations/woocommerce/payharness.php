<?php
/**
 * Plugin Name: PayHarness for WooCommerce
 * Description: PayHarness payment gateway for WooCommerce with M-Pesa and PayPal support, signed webhook order updates, and refunds.
 * Version: 0.1.0
 * Requires Plugins: woocommerce
 * Requires PHP: 7.4
 * Author: PayHarness
 * License: GPL-2.0-or-later
 * Text Domain: payharness
 */

defined('ABSPATH') || exit;

define('PAYHARNESS_WC_VERSION', '0.1.0');
define('PAYHARNESS_WC_PATH', plugin_dir_path(__FILE__));

action_exists('plugins_loaded') && add_action('plugins_loaded', 'payharness_wc_init', 20);

function payharness_wc_init() {
    if (!class_exists('WooCommerce')) {
        return;
    }

    require_once PAYHARNESS_WC_PATH . 'includes/class-payharness-api.php';
    require_once PAYHARNESS_WC_PATH . 'includes/class-wc-gateway-payharness.php';

    add_filter('woocommerce_payment_gateways', function ($gateways) {
        $gateways[] = 'WC_Gateway_PayHarness';
        return $gateways;
    });

    add_action('rest_api_init', 'payharness_wc_register_webhook_route');
}

function payharness_wc_register_webhook_route() {
    register_rest_route('payharness/v1', '/webhook', [
        'methods' => 'POST',
        'permission_callback' => '__return_true',
        'callback' => 'payharness_wc_handle_webhook',
    ]);
}

function payharness_wc_handle_webhook(WP_REST_Request $request) {
    $gateway = new WC_Gateway_PayHarness();
    $secret = $gateway->get_option('webhook_secret');
    if (!$secret) {
        return new WP_Error('payharness_webhook_not_configured', 'PayHarness webhook secret is not configured.', ['status' => 503]);
    }

    $raw_body = $request->get_body();
    $signature = $request->get_header('x-payharness-signature');
    if (!payharness_wc_verify_signature($secret, $signature, $raw_body)) {
        return new WP_Error('payharness_invalid_signature', 'Invalid PayHarness webhook signature.', ['status' => 401]);
    }

    $payload = json_decode($raw_body, true);
    if (!is_array($payload)) {
        return new WP_Error('payharness_invalid_payload', 'Webhook payload must be valid JSON.', ['status' => 400]);
    }

    $payment_id = isset($payload['paymentId']) ? sanitize_text_field($payload['paymentId']) : '';
    $event_type = isset($payload['type']) ? sanitize_text_field($payload['type']) : '';
    if (!$payment_id || !$event_type) {
        return new WP_Error('payharness_missing_fields', 'Webhook paymentId and type are required.', ['status' => 400]);
    }

    $orders = wc_get_orders([
        'limit' => 1,
        'meta_key' => '_payharness_payment_id',
        'meta_value' => $payment_id,
    ]);
    if (!$orders) {
        return new WP_REST_Response(['received' => true, 'matched' => false], 200);
    }

    $order = $orders[0];
    if ($event_type === 'payment.succeeded') {
        if (!$order->is_paid()) {
            $order->payment_complete($payment_id);
            $order->add_order_note('PayHarness payment succeeded. Payment ID: ' . $payment_id);
        }
    } elseif ($event_type === 'payment.failed') {
        if (!$order->has_status(['completed', 'processing', 'refunded'])) {
            $order->update_status('failed', 'PayHarness payment failed. Payment ID: ' . $payment_id);
        }
    } elseif ($event_type === 'payment.refunded') {
        if (!$order->has_status('refunded')) {
            $order->update_status('refunded', 'PayHarness payment refunded. Payment ID: ' . $payment_id);
        }
    }

    return new WP_REST_Response(['received' => true, 'matched' => true], 200);
}

function payharness_wc_verify_signature($secret, $header, $body) {
    if (!is_string($header) || !preg_match('/(?:^|,)t=([0-9]+)(?:,|$)/', $header, $timestamp_match)) {
        return false;
    }
    if (!preg_match('/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/', $header, $signature_match)) {
        return false;
    }

    $timestamp = (int) $timestamp_match[1];
    if (abs(time() - $timestamp) > 300) {
        return false;
    }

    $derived_key = hash('sha256', $secret);
    $expected = hash_hmac('sha256', $timestamp . '.' . $body, $derived_key);
    return hash_equals($expected, $signature_match[1]);
}

register_deactivation_hook(__FILE__, function () {
    wp_clear_scheduled_hook('payharness_wc_status_poll');
});
