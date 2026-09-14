import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const requiredFiles = [
  'docs/public-api.md',
  'docs/webhook-signatures.md',
  'packages/sdk-js/package.json',
  'packages/sdk-php/composer.json',
  'packages/sdk-python/pyproject.toml',
  'packages/sdk-go/go.mod',
  '../integrations/woocommerce/payharness.php',
  '../integrations/woocommerce/includes/class-payharness-api.php',
  '../integrations/woocommerce/includes/class-wc-gateway-payharness.php',
  '../integrations/joomla/payharness.xml',
  '../integrations/joomla/payharness.php',
  '../integrations/joomla/payharnesswebhook.php',
];

const failures = [];

for (const relative of requiredFiles) {
  const absolute = path.resolve(root, relative);
  if (!fs.existsSync(absolute)) failures.push(`Missing required integration artifact: ${relative}`);
}

const read = (relative) => fs.readFileSync(path.resolve(root, relative), 'utf8');

const apiDocs = read('docs/public-api.md');
const webhookDocs = read('docs/webhook-signatures.md');

for (const required of ['POST /payments', 'GET /payments/:id', 'refund', 'payout', 'idempotency']) {
  if (!apiDocs.toLowerCase().includes(required.toLowerCase())) {
    failures.push(`Public API docs do not mention: ${required}`);
  }
}

for (const required of ['X-PayHarness-Signature', 't=<timestamp>,v1=<hex>', '300']) {
  if (!webhookDocs.includes(required)) failures.push(`Webhook security docs do not mention: ${required}`);
}

const packageJson = JSON.parse(read('packages/sdk-js/package.json'));
if (packageJson.name !== '@payharness/sdk-js') failures.push('Node.js SDK package name is not @payharness/sdk-js');
if (packageJson.version !== '0.1.0') failures.push('Node.js SDK version is not 0.1.0');

const composer = JSON.parse(read('packages/sdk-php/composer.json'));
if (composer.require?.php !== '>=8.1') failures.push('PHP SDK minimum PHP version is not >=8.1');

const python = read('packages/sdk-python/pyproject.toml');
if (!python.includes('name = "payharness"')) failures.push('Python SDK package name is not payharness');
if (!python.includes('requires-python = ">=3.9"')) failures.push('Python SDK minimum version is not >=3.9');

const go = read('packages/sdk-go/go.mod');
if (!go.includes('module github.com/mojjoiv/harness/payharness/packages/sdk-go')) failures.push('Go SDK module path is incorrect');

const woocommerce = read('../integrations/woocommerce/payharness.php');
const joomlaWebhook = read('../integrations/joomla/payharnesswebhook.php');
for (const required of ['payharness', 'webhook']) {
  if (!woocommerce.toLowerCase().includes(required)) failures.push(`WooCommerce integration missing ${required} capability`);
  if (!joomlaWebhook.toLowerCase().includes(required)) failures.push(`Joomla webhook integration missing ${required} capability`);
}

if (failures.length) {
  console.error('Integration certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Integration certification PASSED');
console.log(`Validated ${requiredFiles.length} integration artifacts plus API, webhook, and SDK contracts.`);
