import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pluginRoot = path.resolve(root, '../integrations/woocommerce');
const gateway = fs.readFileSync(path.join(pluginRoot, 'includes/class-wc-gateway-payharness.php'), 'utf8');
const api = fs.readFileSync(path.join(pluginRoot, 'includes/class-payharness-api.php'), 'utf8');
const plugin = fs.readFileSync(path.join(pluginRoot, 'payharness.php'), 'utf8');
const webhook = fs.readFileSync(path.join(pluginRoot, 'includes/class-payharness-webhook.php'), 'utf8');

const required = [
  [gateway, 'Idempotency-Key', 'checkout idempotency'],
  [gateway, "'wc-order-' . $order->get_id()", 'stable checkout idempotency key'],
  [gateway, 'ph_live_', 'live API-key prefix enforcement'],
  [gateway, 'ph_sandbox_', 'sandbox API-key prefix enforcement'],
  [gateway, "strtolower((string) ($parsed_api_url['scheme'] ?? '')) !== 'https'", 'HTTPS API URL enforcement'],
  [gateway, "strtolower((string) wp_parse_url($redirect, PHP_URL_SCHEME)) === 'https'", 'HTTPS redirect enforcement'],
  [gateway, 'process_refund', 'WooCommerce refund support'],
  [gateway, 'wc-refund-', 'stable refund idempotency'],
  [api, "'reason'", 'refund reason forwarding'],
  [api, 'Authorization', 'server-side authorization header'],
  [api, 'wp_remote_request', 'server-side API transport'],
  [plugin, 'x-payharness-signature', 'signed webhook verification'],
  [plugin, 'x-payharness-event', 'webhook event header validation'],
  [plugin, '_payharness_processed_webhook_events', 'persistent duplicate webhook protection'],
  [plugin, 'payment.succeeded', 'success event handling'],
  [plugin, 'payment.failed', 'failure event handling'],
  [plugin, 'payment.refunded', 'refund event handling'],
  [webhook, 'hash_hmac', 'HMAC signature verification'],
  [webhook, 'hash_equals', 'constant-time signature comparison'],
  [webhook, '300', 'five-minute replay tolerance'],
];

for (const [source, needle, description] of required) {
  assert(source.includes(needle), `Missing WooCommerce certification requirement: ${description}`);
}

const secret = 'whsec_certification_secret';
const timestamp = 1700000000;
const body = JSON.stringify({ paymentId: 'pay_cert_123', type: 'payment.succeeded' });
const derivedKey = crypto.createHash('sha256').update(secret).digest('hex');
const signature = crypto.createHmac('sha256', derivedKey).update(`${timestamp}.${body}`).digest('hex');
const header = `t=${timestamp},v1=${signature}`;

const php = spawnSync(
  'php',
  ['-r', `define('ABSPATH', true); require ${JSON.stringify(path.join(pluginRoot, 'includes/class-payharness-webhook.php'))}; echo PayHarness_Webhook::verify_signature(${JSON.stringify(secret)}, ${JSON.stringify(header)}, ${JSON.stringify(body)}, ${timestamp}) ? 'valid' : 'invalid';`],
  { encoding: 'utf8' },
);

assert.equal(php.status, 0, `PHP webhook verifier exited with ${php.status}: ${php.stderr}`);
assert.equal(php.stdout, 'valid', 'Known-good PayHarness webhook signature must verify');

const staleHeader = `t=${timestamp - 301},v1=${signature}`;
const stale = spawnSync(
  'php',
  ['-r', `define('ABSPATH', true); require ${JSON.stringify(path.join(pluginRoot, 'includes/class-payharness-webhook.php'))}; echo PayHarness_Webhook::verify_signature(${JSON.stringify(secret)}, ${JSON.stringify(staleHeader)}, ${JSON.stringify(body)}, ${timestamp}) ? 'valid' : 'invalid';`],
  { encoding: 'utf8' },
);
assert.equal(stale.status, 0, `PHP stale-signature verifier exited with ${stale.status}: ${stale.stderr}`);
assert.equal(stale.stdout, 'invalid', 'Webhook signatures older than five minutes must be rejected');

console.log('WooCommerce certification PASSED');
console.log(`Validated ${required.length} integration contracts plus live HMAC verification and replay-window rejection.`);
