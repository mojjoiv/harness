<?php
defined('_JEXEC') or die;

if (!class_exists('vmPSPlugin')) {
    return;
}

class plgVmPaymentPayHarness extends vmPSPlugin
{
    public function __construct(&$subject, $config)
    {
        parent::__construct($subject, $config);
        $this->_loggable = true;
        $this->setConfigParameterable('payharness', $this->_configTableFieldName);
    }

    public function plgVmDisplayListFE($virtuemart_paymentmethod_id, &$cart) { return null; }

    public function plgVmConfirmedOrder($cart, $order)
    {
        if (empty($order['details']['BT'])) return false;
        $method = $this->getMethod($order['details']['BT']->virtuemart_paymentmethod_id);
        if (!$method || empty($method->published)) return false;

        $provider = strtoupper((string) $method->provider);
        $environment = strtoupper((string) $method->environment);
        $api_url = rtrim(trim((string) $method->api_url), '/');
        $api_key = trim((string) $method->api_key);

        if (!in_array($provider, array('MPESA', 'PAYPAL'), true)) {
            vmError('PayHarness provider is not supported.');
            return false;
        }
        if (!in_array($environment, array('SANDBOX', 'LIVE'), true)) {
            vmError('PayHarness environment is not supported.');
            return false;
        }
        if ($api_url === '' || strtolower((string) parse_url($api_url, PHP_URL_SCHEME)) !== 'https') {
            vmError('PayHarness API URL must use HTTPS.');
            return false;
        }
        $expected_prefix = $environment === 'LIVE' ? 'ph_live_' : 'ph_sandbox_';
        if (strpos($api_key, $expected_prefix) !== 0) {
            vmError('PayHarness API key does not match the selected environment.');
            return false;
        }
        if ($environment === 'LIVE' && $provider === 'PAYPAL') {
            vmError('Live PayPal processing is not enabled yet.');
            return false;
        }

        $order_number = (string) $order['details']['BT']->order_number;
        $amount_cents = (int) round(((float) $order['details']['BT']->order_total) * 100);
        if ($amount_cents <= 0) {
            vmError('PayHarness payment amount must be greater than zero.');
            return false;
        }

        $payload = array(
            'amountCents' => $amount_cents,
            'currency' => $this->getCurrencyCode($order['details']['BT']->order_currency),
            'environment' => $environment,
            'provider' => $provider,
            'metadata' => array(
                'source' => 'joomla-virtuemart',
                'orderNumber' => $order_number,
                'orderId' => (string) $order['details']['BT']->virtuemart_order_id,
            ),
        );

        if ($provider === 'MPESA') {
            $payload['accountReference'] = 'VM-' . $order_number;
        }

        $result = $this->request($method, '/payments', $payload, 'joomla-order-' . $order_number);
        if ($result instanceof Exception) {
            vmError('PayHarness payment creation failed: ' . $result->getMessage());
            return false;
        }

        $payment = isset($result['data']) && is_array($result['data']) ? $result['data'] : $result;
        $payment_id = isset($payment['paymentId']) ? (string) $payment['paymentId'] : '';
        if ($payment_id === '') {
            vmError('PayHarness did not return a payment ID.');
            return false;
        }

        $this->storePaymentReference((int) $order['details']['BT']->virtuemart_order_id, $payment_id, $provider, $environment);

        $redirect = isset($payment['approvalUrl']) ? $payment['approvalUrl'] : (isset($payment['redirectUrl']) ? $payment['redirectUrl'] : '');
        if ($redirect !== '') {
            if (strtolower((string) parse_url($redirect, PHP_URL_SCHEME)) !== 'https') {
                vmError('PayHarness approval URL must use HTTPS.');
                return false;
            }
            if (method_exists($cart, 'emptyCart')) $cart->emptyCart();
            Joomla\CMS\Factory::getApplication()->redirect($redirect);
            return true;
        }

        if (method_exists($cart, 'emptyCart')) $cart->emptyCart();
        return true;
    }

    public function plgVmOnPaymentResponseReceived(&$html) { return true; }

    public function plgVmgetPaymentCurrency($virtuemart_paymentmethod_id, &$paymentCurrencyId)
    {
        $paymentCurrencyId = 0;
        return true;
    }

    private function getMethod($paymentmethod_id)
    {
        $db = JFactory::getDbo();
        $query = $db->getQuery(true)->select('*')->from($db->quoteName('#__virtuemart_paymentmethods'))
            ->where($db->quoteName('virtuemart_paymentmethod_id') . ' = ' . (int) $paymentmethod_id);
        $db->setQuery($query);
        $method = $db->loadObject();
        if (!$method) return null;

        $params = new JRegistry($method->params);
        foreach (array('api_url', 'api_key', 'environment', 'provider', 'webhook_secret') as $key) {
            $method->{$key} = $params->get($key, '');
        }
        return $method;
    }

    private function request($method, $path, $body, $idempotency_key)
    {
        $api_url = rtrim(trim((string) $method->api_url), '/');
        $api_key = trim((string) $method->api_key);
        if ($api_url === '' || $api_key === '') return new Exception('PayHarness API URL and API key are required.');
        if (strtolower((string) parse_url($api_url, PHP_URL_SCHEME)) !== 'https') return new Exception('PayHarness API URL must use HTTPS.');

        $ch = curl_init($api_url . $path);
        curl_setopt_array($ch, array(
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => array(
                'Authorization: Bearer ' . $api_key,
                'Accept: application/json',
                'Content-Type: application/json',
                'Idempotency-Key: ' . $idempotency_key,
                'User-Agent: PayHarness-Joomla/0.1.0',
            ),
            CURLOPT_POSTFIELDS => json_encode($body),
        ));
        $raw = curl_exec($ch);
        if ($raw === false) {
            $error = curl_error($ch);
            curl_close($ch);
            return new Exception('PayHarness request failed: ' . $error);
        }
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $decoded = json_decode($raw, true);
        if ($status < 200 || $status >= 300 || !is_array($decoded)) {
            $message = is_array($decoded) && isset($decoded['message']) ? $decoded['message'] : 'PayHarness API request failed.';
            return new Exception($message . ' HTTP ' . $status);
        }
        return $decoded;
    }

    private function storePaymentReference($order_id, $payment_id, $provider, $environment)
    {
        $db = JFactory::getDbo();
        $query = $db->getQuery(true)->update($db->quoteName('#__virtuemart_orders'))
            ->set($db->quoteName('customer_note') . ' = ' . $db->quote('PayHarness payment: ' . $payment_id . ' (' . $provider . ', ' . $environment . ')'))
            ->where($db->quoteName('virtuemart_order_id') . ' = ' . (int) $order_id);
        $db->setQuery($query);
        $db->execute();
    }

    private function getCurrencyCode($currency_id)
    {
        $db = JFactory::getDbo();
        $query = $db->getQuery(true)->select($db->quoteName('currency_code_3'))
            ->from($db->quoteName('#__virtuemart_currencies'))
            ->where($db->quoteName('virtuemart_currency_id') . ' = ' . (int) $currency_id);
        $db->setQuery($query);
        $code = $db->loadResult();
        return strtoupper((string) $code) ?: 'KES';
    }
}
