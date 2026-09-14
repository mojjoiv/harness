<?php
defined('_JEXEC') or die;

class PlgSystemPayHarnessWebhook extends JPlugin
{
    public function onAfterInitialise()
    {
        $app = Joomla\CMS\Factory::getApplication();
        if (!$app->isClient('site') || !$app->input->getInt('payharness_webhook', 0)) return;

        $body = file_get_contents('php://input');
        $signature = $app->input->server->getString('HTTP_X_PAYHARNESS_SIGNATURE', '');
        if (!$this->verifySignature($signature, $body)) {
            $this->respond(array('error' => 'Invalid PayHarness webhook signature.'), 401);
        }

        $payload = json_decode($body, true);
        if (!is_array($payload)) $this->respond(array('error' => 'Invalid JSON payload.'), 400);

        $payment_id = isset($payload['paymentId']) ? (string) $payload['paymentId'] : '';
        $event_type = isset($payload['type']) ? (string) $payload['type'] : '';
        if ($payment_id === '' || $event_type === '') $this->respond(array('error' => 'paymentId and type are required.'), 400);

        $db = JFactory::getDbo();
        $orders = $this->findOrders($db, $payment_id);
        foreach ($orders as $order) {
            $status = $this->mapStatus($event_type);
            if ($status !== '') {
                $query = $db->getQuery(true)->update($db->quoteName('#__virtuemart_orders'))
                    ->set($db->quoteName('order_status') . ' = ' . $db->quote($status))
                    ->where($db->quoteName('virtuemart_order_id') . ' = ' . (int) $order->virtuemart_order_id);
                $db->setQuery($query)->execute();
            }
        }

        $this->respond(array('received' => true, 'matched' => count($orders) > 0), 200);
    }

    private function findOrders($db, $payment_id)
    {
        $query = $db->getQuery(true)->select('*')->from($db->quoteName('#__virtuemart_orders'))
            ->where($db->quoteName('customer_note') . ' LIKE ' . $db->quote('%PayHarness payment: ' . $payment_id . '%'));
        $db->setQuery($query);
        return (array) $db->loadObjectList();
    }

    private function mapStatus($event_type)
    {
        if ($event_type === 'payment.succeeded') return 'C';
        if ($event_type === 'payment.failed') return 'X';
        if ($event_type === 'payment.refunded') return 'R';
        return '';
    }

    private function verifySignature($header, $body)
    {
        if (!preg_match('/(?:^|,)t=([0-9]+)(?:,|$)/', $header, $timestamp_match)) return false;
        if (!preg_match('/(?:^|,)v1=([a-f0-9]{64})(?:,|$)/', $header, $signature_match)) return false;
        $timestamp = (int) $timestamp_match[1];
        if (abs(time() - $timestamp) > 300) return false;

        $secret = $this->getWebhookSecret();
        if ($secret === '') return false;
        $key = hash('sha256', $secret);
        $expected = hash_hmac('sha256', $timestamp . '.' . $body, $key);
        return hash_equals($expected, $signature_match[1]);
    }

    private function getWebhookSecret()
    {
        $db = JFactory::getDbo();
        $query = $db->getQuery(true)->select($db->quoteName('params'))
            ->from($db->quoteName('#__virtuemart_paymentmethods'))
            ->where($db->quoteName('payment_params') . ' LIKE ' . $db->quote('%webhook_secret%'));
        $db->setQuery($query, 0, 20);
        foreach ((array) $db->loadColumn() as $params_json) {
            $params = new JRegistry($params_json);
            $secret = trim((string) $params->get('webhook_secret', ''));
            if ($secret !== '') return $secret;
        }
        return '';
    }

    private function respond($payload, $status)
    {
        $app = Joomla\CMS\Factory::getApplication();
        $app->setHeader('Content-Type', 'application/json', true);
        $app->setHeader('Status', (string) $status, true);
        echo json_encode($payload);
        $app->close();
    }
}
