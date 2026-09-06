const baseUrl = process.env.PAYHARNESS_BASE_URL;
const apiKey = process.env.PAYHARNESS_API_KEY;
const amountCents = Number(process.env.STRIPE_E2E_AMOUNT_CENTS || 1000);
const currency = process.env.STRIPE_E2E_CURRENCY || 'usd';

if (!baseUrl || !apiKey) {
  console.error('Missing PAYHARNESS_BASE_URL or PAYHARNESS_API_KEY.');
  process.exit(2);
}

const headers = {
  Authorization: `Bearer ${apiKey}`,
  'Content-Type': 'application/json',
  'Idempotency-Key': `stripe-e2e-${Date.now()}`,
};

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl.replace(/\\/$/, '')}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

const result = await request('/payments/stripe/intent', {
  method: 'POST',
  body: JSON.stringify({
    environment: 'SANDBOX',
    amountCents,
    currency,
    metadata: { source: 'stripe-e2e-smoke' },
  }),
});

console.log(JSON.stringify({
  ok: true,
  paymentId: result.paymentId,
  providerReference: result.providerReference,
  status: result.status,
  hasClientSecret: Boolean(result.clientSecret),
}, null, 2));

if (!result.paymentId || !result.providerReference || !result.clientSecret) {
  throw new Error('Stripe intent response is missing paymentId, providerReference, or clientSecret.');
}

console.log('\nNext step: confirm the returned PaymentIntent in Stripe Sandbox with a test PaymentMethod (for example pm_card_visa), then poll:');
console.log(`GET ${baseUrl.replace(/\\/$/, '')}/payments/${result.paymentId}/query`);
