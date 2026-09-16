<?php
defined('_JEXEC') or die;

require_once __DIR__ . '/payharnesswebhookhelper.php';

class PlgSystemPayHarnessWebhook extends JPlugin
{
    public function onAfterInitialise()
    {
        $app = Joomla\CMS\Factory::getApplication();
        if (!$app->isClient('site') || !$app->input->getInt('payharness_webhook', 0)) return;

        $body = file_get_contents('php://input');
        $signature = $app->input->server->getString('HTTP_X_PAYHARNESS_SIGNATURE', '');
        if (!$this->verifyAgainstConfiguredSecrets($signature, $body)) {
            $this->respond(array('error' => 'Invalid PayHarness webhook signature.'), 401);
        }

        $payload = json_decode($body, true);
        if (!is_array($payload)) $this->respond(array('error' => 'Invalid JSON payload.'), 400);

        $payment_id = isset($payload['paymentId']) ? (string) $payload['paymentId'] : '';
        $event_type = isset($payload['type']) ? (string) $payload['type'] : '';
        if ($payment_id === '' || $event_type === '') $this->respond(array('error' => 'paymentId and type are required.'), 400);

        $event_header = $app->input->server->getString('HTTP_X_PAYHARNESS_EVENT', '');
        if ($event_header !== '' && !hash_equals($event_type, $event_header)) {
            $this->respond(array('error' => 'Webhook event header does not match the payload.'), 400);
        }

        $status = $this->mapStatus($event_type);
        if ($status === '') {
            $this->respond(array('received' => true, 'matched' => false, 'ignored' => true), 200);
        }

        $db = JFactory::getDbo();
        $orders = $this->findOrders($db, $payment_id);
        if (!$orders) {
            $this->respond(array('received' => true, 'matched' => false), 200);
        }

        $fingerprint = PayHarnessJoomlaWebhook::fingerprint($event_type, $body);
        foreach ($orders as $order) {
            $processed_events = $this->getProcessedEvents($order->customer_note);
            if (isset($processed_events[$fingerprint])) {
                continue;
            }

            $current_status = strtoupper((string) $order->order_status);
            if ($this->canTransition($current_status, $status)) {
                $query = $db->getQuery(true)->update($db->quoteName('#__virtuemart_orders'))
                    ->set($db->quoteName('order_status') . ' = ' . $db->quote($status))
                    ->where($db->quoteName('virtuemart_order_id') . ' = ' . (int) $order->virtuemart_order_id);
                $db->setQuery($query)->execute();
            }

            $updated_note = $this->appendProcessedEvent($order->customer_note, $fingerprint);
            $query = $db->getQuery(true)->update($db->quoteName('#__virtuemart_orders'))
                ->set($db->quoteName('customer_note') . ' = ' . $db->quote($updated_note))
                ->where($db->quoteName('virtuemart_order_id') . ' = ' . (int) $order->virtuemart_order_id);
            $db->setQuery($query)->execute();
        }

        $this->respond(array('received' => true, 'matched' => true), 200);
    }

    private function findOrders($db, $payment_id)
    {
        $query = $db->getQuery(true)->select('*')->from($db->quoteName('#__virtuemart_orders'))
            ->where($db->quoteName('customer_note') . ' LIKE ' . $db->quote('%PayHarness payment: ' . $db->escape($payment_id, true) . '%', false));
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

    private function canTransition($current_status, $next_status)
    {
        if ($current_status === $next_status) return false;
        if (in_array($current_status, array('F', 'S', 'R'), true)) return false;
        if ($next_status === 'X' && in_array($current_status, array('C', 'U'), true)) return false;
        if ($next_status === 'R' && $current_status === 'X') return false;
        return true;
    }

    private function verifyAgainstConfiguredSecrets($header, $body)
    {
        $db = JFactory::getDbo();
        $query = $db->getQuery(true)->select($db->quoteName('payment_params'))
            ->from($db->quoteName('#__virtuemart_paymentmethods'))
            ->where($db->quoteName('payment_params') . ' LIKE ' . $db->quote('%webhook_secret%'));
        $db->setQuery($query, 0, 50);
        foreach ((array) $db->loadColumn() as $params_json) {
            $params = new JRegistry($params_json);
            $secret = trim((string) $params->get('webhook_secret', ''));
            if ($secret !== '' && PayHarnessJoomlaWebhook::verifySignature($secret, $header, $body)) {
                return true;
            }
        }
        return false;
    }

    private function getProcessedEvents($customer_note)
    {
        $marker = 'PayHarness processed events: ';
        $position = strpos((string) $customer_note, $marker);
        if ($position === false) return array();
        $json = trim(substr((string) $customer_note, $position + strlen($marker)));
        $decoded = json_decode($json, true);
        return is_array($decoded) ? $decoded : array();
    }

    private function appendProcessedEvent($customer_note, $fingerprint)
    {
        $marker = 'PayHarness processed events: ';
        $note = (string) $customer_note;
        $processed = $this->getProcessedEvents($note);
        $processed[$fingerprint] = time();
        if (count($processed) > 50) {
            uasort($processed, function ($left, $right) {
                return $left <=> $right;
            });
            $processed = array_slice($processed, -50, 50, true);
        }
        $position = strpos($note, $marker);
        if ($position !== false) {
            $note = rtrim(substr($note, 0, $position));
        }
        return rtrim($note) . ($note !== '' ? "\n" : '') . $marker . json_encode($processed);
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
