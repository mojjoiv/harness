<?php

defined('ABSPATH') || exit;

class WC_Gateway_PayHarness extends WC_Payment_Gateway {
    public function __construct() {
        $this->id = 'payharness';
        $this->icon = '';
        $this->has_fields = false;
        $this->method_title = 'PayHarness';
        $this->method_description = 'Accept PayHarness payments through M-Pesa or PayPal.';

        $this->supports = ['products', 'refunds'];

        $this->init_form_fields();
        $this->init_settings();

        $this->title = $this->get_option('title', 'PayHarness');
        $this->description = $this->get_option('description', 'Pay securely using PayHarness.');

        add_action('woocommerce_update_options_payment_gateways_' . $this->id, [$this, 'process_admin_options']);
        add_action('woocommerce_thankyou_' . $this->id, [$this, 'thank_you_page']);
    }

    public function init_form_fields() {
        $this->form_fields = [
            'enabled' => [
                'title' => 'Enable/Disable',
                'type' => 'checkbox',
                'label' => 'Enable PayHarness',
                'default' => 'no',
            ],
            'title' => [
                'title' => 'Title',
                'type' => 'text',
                'default' => 'PayHarness',
                'description' => 'The payment method name shown to customers.',
            ],
            'description' => [
                'title' => 'Description',
                'type' => 'textarea',
                'default' => 'Pay securely using PayHarness.',
            ],
            'api_url' => [
                'title' => 'PayHarness API URL',
                'type' => 'url',
                'default' => 'https://harness-1.onrender.com',
                'description' => 'Use the PayHarness API base URL. Do not add /payments.',
            ],
            'api_key' => [
                'title' => 'PayHarness API Key',
                'type' => 'password',
                'description' => 'Use a server-side ph_live_ key for production or ph_sandbox_ for testing.',
            ],
            'environment' => [
                'title' => 'Environment',
                'type' => 'select',
                'options' => [
                    'SANDBOX' => 'Sandbox',
                    'LIVE' => 'Live',
                ],
                'default' => 'SANDBOX',
            ],
            'provider' => [
                'title' => 'Provider',
                'type' => 'select',
                'options' => [
                    'MPESA' => 'M-Pesa',
                    'PAYPAL' => 'PayPal',
                ],
                'default' => 'MPESA',
            ],
            'webhook_secret' => [
                'title' => 'Webhook Secret',
                'type' => 'password',
                'description' => 'Paste the whsec_ secret returned when you create the WooCommerce webhook endpoint in PayHarness.',
            ],
        ];
    }

    public function payment_fields() {
        if ($this->description) {
            echo wpautop(wp_kses_post($this->description));
        }

        if ($this->get_option('provider') === 'MPESA') {
            echo '<p>After placing the order, PayHarness will initiate the configured M-Pesa payment flow.</p>';
        } else {
            echo '<p>You will be redirected to PayPal to approve the payment.</p>';
        }
    }

    public function process_payment($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            wc_add_notice('Unable to load the WooCommerce order.', 'error');
            return ['result' => 'failure'];
        }

        $provider = strtoupper($this->get_option('provider', 'MPESA'));
        if (!in_array($provider, ['MPESA', 'PAYPAL'], true)) {
            wc_add_notice('The selected PayHarness provider is not supported by this gateway.', 'error');
            return ['result' => 'failure'];
        }

        $environment = strtoupper($this->get_option('environment', 'SANDBOX'));
        $payload = [
            'amountCents' => (int) round(((float) $order->get_total()) * 100),
            'currency' => strtoupper($order->get_currency()),
            'environment' => $environment,
            'customerId' => (string) $order->get_customer_id(),
            'metadata' => [
                'source' => 'woocommerce',
                'orderId' => (string) $order->get_id(),
                'orderNumber' => (string) $order->get_order_number(),
                'customerEmail' => (string) $order->get_billing_email(),
            ],
        ];

        if ($provider === 'MPESA') {
            $payload['metadata']['accountReference'] = 'WC-' . $order->get_order_number();
        }

        $api = new PayHarness_API($this->get_option('api_url'), $this->get_option('api_key'));
        $result = $api->create_payment($payload + ['provider' => $provider], 'wc-order-' . $order->get_id());
        if (is_wp_error($result)) {
            wc_add_notice(esc_html($result->get_error_message()), 'error');
            return ['result' => 'failure'];
        }

        $payment = $result['data'] ?? $result;
        $payment_id = isset($payment['paymentId']) ? sanitize_text_field($payment['paymentId']) : '';
        if (!$payment_id) {
            wc_add_notice('PayHarness did not return a payment ID.', 'error');
            return ['result' => 'failure'];
        }

        $order->update_meta_data('_payharness_payment_id', $payment_id);
        $order->update_meta_data('_payharness_provider', $provider);
        $order->update_meta_data('_payharness_environment', $environment);
        $order->save();
        $order->add_order_note('PayHarness payment created: ' . $payment_id . ' (' . $provider . ', ' . $environment . ').');

        $status = isset($payment['status']) ? strtoupper($payment['status']) : 'PENDING';
        if ($status === 'SUCCEEDED') {
            $order->payment_complete($payment_id);
        } else {
            $order->update_status('on-hold', 'Awaiting PayHarness payment confirmation.');
        }

        $redirect = $payment['approvalUrl'] ?? $payment['redirectUrl'] ?? '';
        if ($redirect && filter_var($redirect, FILTER_VALIDATE_URL)) {
            WC()->cart->empty_cart();
            return [
                'result' => 'success',
                'redirect' => esc_url_raw($redirect),
            ];
        }

        WC()->cart->empty_cart();
        return [
            'result' => 'success',
            'redirect' => $this->get_return_url($order),
        ];
    }

    public function process_refund($order_id, $amount = null, $reason = '') {
        $order = wc_get_order($order_id);
        if (!$order) {
            return new WP_Error('payharness_order_not_found', 'WooCommerce order not found.');
        }

        $payment_id = $order->get_meta('_payharness_payment_id');
        if (!$payment_id) {
            return new WP_Error('payharness_payment_not_found', 'No PayHarness payment is linked to this order.');
        }

        $amount_cents = $amount === null ? null : (int) round(((float) $amount) * 100);
        $refund_id = 'unknown';
        $idempotency_key = 'wc-refund-' . $order->get_id() . '-' . wp_generate_uuid4();

        $api = new PayHarness_API($this->get_option('api_url'), $this->get_option('api_key'));
        $result = $api->refund_payment($payment_id, $amount_cents, $idempotency_key);
        if (is_wp_error($result)) {
            return $result;
        }

        $refund = $result['data'] ?? $result;
        $refund_id = isset($refund['refundId']) ? sanitize_text_field($refund['refundId']) : $refund_id;
        $order->add_order_note('PayHarness refund submitted' . ($refund_id !== 'unknown' ? ': ' . $refund_id : '.') . ($reason ? ' Reason: ' . $reason : ''));
        return true;
    }

    public function thank_you_page($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }

        $payment_id = $order->get_meta('_payharness_payment_id');
        if ($payment_id && $order->has_status('on-hold')) {
            echo '<p>' . esc_html__('Your payment is awaiting confirmation from PayHarness. You can safely leave this page; the order will update automatically when PayHarness confirms payment.', 'payharness') . '</p>';
        }
    }
}
