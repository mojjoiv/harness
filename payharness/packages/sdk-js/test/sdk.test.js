import test from 'node:test';
import assert from 'node:assert/strict';
import { PayHarnessClient, PayHarnessError, createWebhookSignature, verifyWebhookSignature } from '../dist/index.js';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) };
}

test('creates payments with bearer auth and idempotency', async () => {
  let request;
  const client = new PayHarnessClient({
    apiKey: 'ph_sandbox_test',
    baseUrl: 'https://example.test',
    fetch: async (url, init) => {
      request = { url, init };
      return response(201, { success: true, data: { paymentId: 'pay_123' }, meta: { requestId: 'req_1' } });
    },
  });

  const result = await client.payments.create({ amountCents: 1000, currency: 'KES', environment: 'SANDBOX', provider: 'MPESA' }, 'checkout-123');
  assert.equal(result.data.paymentId, 'pay_123');
  assert.equal(request.url, 'https://example.test/payments');
  assert.equal(request.init.headers.authorization, 'Bearer ph_sandbox_test');
  assert.equal(request.init.headers['idempotency-key'], 'checkout-123');
});

test('supports payment query and refunds', async () => {
  const calls = [];
  const client = new PayHarnessClient({
    apiKey: 'ph_live_test',
    baseUrl: 'https://example.test',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response(200, { success: true, data: { status: 'SUCCEEDED' } });
    },
  });

  await client.payments.query('pay/123');
  await client.refunds.create('pay_123', { amountCents: 500 }, 'refund-1');
  assert.equal(calls[0].url, 'https://example.test/payments/pay%2F123/query');
  assert.equal(calls[1].init.headers['idempotency-key'], 'refund-1');
});

test('supports payout creation and listing', async () => {
  const calls = [];
  const client = new PayHarnessClient({
    apiKey: 'ph_live_test',
    baseUrl: 'https://example.test',
    fetch: async (url, init) => {
      calls.push({ url, init });
      return response(200, { success: true, data: [] });
    },
  });

  await client.payouts.create({ amountCents: 2000, currency: 'KES', provider: 'MPESA', recipientReference: '254700000000' }, 'payout-1');
  await client.payouts.list({ page: 2, limit: 20, status: 'SUCCEEDED' });
  assert.equal(calls[0].init.headers['idempotency-key'], 'payout-1');
  assert.equal(calls[1].url, 'https://example.test/payouts?page=2&limit=20&status=SUCCEEDED');
});

test('throws structured PayHarnessError', async () => {
  const client = new PayHarnessClient({
    apiKey: 'ph_live_test',
    fetch: async () => response(401, { message: 'Unauthorized', meta: { requestId: 'req_bad' }, code: 'UNAUTHORIZED' }),
  });
  await assert.rejects(() => client.payments.get('pay_1'), (error) => {
    assert.ok(error instanceof PayHarnessError);
    assert.equal(error.status, 401);
    assert.equal(error.requestId, 'req_bad');
    assert.equal(error.code, 'UNAUTHORIZED');
    return true;
  });
});

test('creates and verifies webhook signatures', () => {
  const body = JSON.stringify({ type: 'payment.succeeded', paymentId: 'pay_123' });
  const timestamp = 1700000000;
  const signature = createWebhookSignature('secret', timestamp, body);
  assert.equal(verifyWebhookSignature('secret', signature, body, timestamp), true);
  assert.equal(verifyWebhookSignature('wrong', signature, body, timestamp), false);
  assert.equal(verifyWebhookSignature('secret', signature, `${body}x`, timestamp), false);
  assert.equal(verifyWebhookSignature('secret', signature, body, timestamp + 301), false);
});
