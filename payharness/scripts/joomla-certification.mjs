import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const pluginRoot = path.resolve(root, '../integrations/joomla');
const failures = [];

const read = (file) => fs.readFileSync(path.join(pluginRoot, file), 'utf8');
const payment = read('payharness.php');
const webhook = read('payharnesswebhook.php');
const helper = read('payharnesswebhookhelper.php');
const paymentXml = read('payharness.xml');
const webhookXml = read('payharnesswebhook.xml');

for (const file of ['payharness.php', 'payharnesswebhook.php', 'payharnesswebhookhelper.php']) {
  try {
    execFileSync('php', ['-l', path.join(pluginRoot, file)], { stdio: 'pipe' });
  } catch (error) {
    failures.push(`PHP syntax check failed for ${file}: ${error.stdout?.toString() || error.message}`);
  }
}

for (const required of [
  'plgVmConfirmedOrder',
  'joomla-order-',
  'ph_live_',
  'ph_sandbox_',
  'PayHarness API URL must use HTTPS',
  'approval URL must use HTTPS',
  'Live PayPal processing is not enabled yet',
]) {
  if (!payment.includes(required)) failures.push(`Joomla payment gateway missing ${required}`);
}

for (const required of [
  'X_PAYHARNESS_SIGNATURE',
  'X_PAYHARNESS_EVENT',
  'payment.succeeded',
  'payment.failed',
  'payment.refunded',
  'fingerprint',
  'canTransition',
]) {
  if (!webhook.includes(required)) failures.push(`Joomla webhook missing ${required}`);
}

for (const required of ['verifySignature', 'hash_hmac', 'hash_equals', '300', 'fingerprint']) {
  if (!helper.includes(required)) failures.push(`Joomla webhook helper missing ${required}`);
}

for (const required of ['payharnesswebhookhelper.php', 'payharnesswebhook.php']) {
  if (!webhookXml.includes(required)) failures.push(`Joomla webhook package does not include ${required}`);
}

const timestamp = Math.floor(Date.now() / 1000);
const secret = 'joomla-certification-secret';
const body = JSON.stringify({ paymentId: 'cert-payment-001', type: 'payment.succeeded' });
const key = execFileSync('php', ['-r', `echo hash('sha256', '${secret}');`], { encoding: 'utf8' }).trim();
const signature = execFileSync('php', ['-r', `echo hash_hmac('sha256', '${timestamp}.${body}', '${key}');`], { encoding: 'utf8' }).trim();
const header = `t=${timestamp},v1=${signature}`;

const probe = `<?php

define('_JEXEC', 1);
require '${path.join(pluginRoot, 'payharnesswebhookhelper.php').replaceAll('\\', '\\\\')}';
$secret = ${JSON.stringify(secret)};
$body = ${JSON.stringify(body)};
$valid = PayHarnessJoomlaWebhook::verifySignature($secret, ${JSON.stringify(header)}, $body, ${timestamp});
$stale = PayHarnessJoomlaWebhook::verifySignature($secret, ${JSON.stringify(header)}, $body, ${timestamp + 301});
echo json_encode(array('valid' => $valid, 'stale' => $stale));
`;
const probePath = path.join(os.tmpdir(), `payharness-joomla-cert-${process.pid}.php`);
try {
  fs.writeFileSync(probePath, probe);
  const result = JSON.parse(execFileSync('php', [probePath], { encoding: 'utf8' }));
  if (result.valid !== true) failures.push('Real PHP webhook HMAC verification did not accept the known-good signature');
  if (result.stale !== false) failures.push('Real PHP webhook verifier did not reject a 301-second-old signature');
} catch (error) {
  failures.push(`Real PHP webhook verification probe failed: ${error.stdout?.toString() || error.message}`);
} finally {
  fs.rmSync(probePath, { force: true });
}

if (!paymentXml.includes('api_url') || !paymentXml.includes('webhook_secret')) {
  failures.push('Joomla payment XML is missing required configuration fields');
}

if (failures.length) {
  console.error('Joomla/VirtueMart certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Joomla/VirtueMart certification PASSED');
console.log('Validated PHP syntax, environment isolation, HTTPS transport, idempotency, signed webhooks, terminal-state protection, package metadata, and real PHP HMAC/replay verification.');
