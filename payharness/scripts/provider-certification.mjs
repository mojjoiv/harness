import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const providers = [
  { id: 'MPESA', adapter: 'mpesa-payment.adapter.ts', verification: 'mpesa-verification.service.ts' },
  { id: 'STRIPE', adapter: 'stripe-payment.adapter.ts', verification: 'stripe-verification.service.ts' },
  { id: 'PAYPAL', adapter: 'paypal-payment.adapter.ts' },
  { id: 'PESAPAL', adapter: 'pesapal-payment.adapter.ts' },
  { id: 'FLUTTERWAVE', adapter: 'flutterwave-payment.adapter.ts' },
];

const read = (relative) => fs.readFileSync(path.resolve(root, relative), 'utf8');
const registry = read('apps/api/src/payment-providers/provider-registry.ts');
const credentials = read('apps/api/src/provider-credentials/provider-credentials.service.ts');
const webhooks = read('apps/api/src/webhooks/webhooks.controller.ts');
const docs = read('docs/API_REFERENCE.md');
const failures = [];

for (const provider of providers) {
  assert(registry.includes("provider: '" + provider.id + "'"), 'Missing provider registry entry: ' + provider.id);

  const adapterPath = 'apps/api/src/payment-providers/adapters/' + provider.adapter;
  assert(fs.existsSync(path.resolve(root, adapterPath)), 'Missing adapter: ' + adapterPath);
  const adapter = read(adapterPath);

  for (const needle of ['readonly provider', 'createPayment(', 'queryPayment(']) {
    if (!adapter.includes(needle)) failures.push(provider.id + ' adapter missing ' + needle);
  }

  if (provider.id === 'MPESA') {
    if (!fs.existsSync(path.resolve(root, 'apps/api/src/payment-providers/mpesa/' + provider.verification))) failures.push('MPESA verification service missing');
  } else if (provider.id === 'STRIPE') {
    if (!fs.existsSync(path.resolve(root, 'apps/api/src/payment-providers/stripe/' + provider.verification))) failures.push('STRIPE verification service missing');
  } else if (!credentials.includes(provider.id)) {
    failures.push(provider.id + ' credential verification path is not represented');
  }

  if (!webhooks.includes('provider/:provider/:merchantId') || !webhooks.includes(provider.id)) {
    failures.push(provider.id + ' webhook routing is not represented');
  }
}

for (const required of [
  'ph_sandbox_',
  'ph_live_',
  'X-PayHarness-Signature',
  'M-Pesa',
  'Stripe',
  'PayPal',
  'Pesapal',
  'Flutterwave',
]) {
  if (!docs.includes(required)) failures.push('API reference missing certification requirement: ' + required);
}

if (failures.length) {
  console.error('Provider certification FAILED');
  for (const failure of failures) console.error('- ' + failure);
  process.exit(1);
}

console.log('Provider certification PASSED');
console.log('Validated ' + providers.length + ' registered provider contracts, adapters, webhook routing, and API capability documentation.');
