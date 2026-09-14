import {
  buildWebhookSignature,
  deriveWebhookSigningKey,
  parseWebhookSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
  verifyWebhookSignatureHeader,
} from './webhook-signature';

describe('webhook signature', () => {
  const secret = 'whsec_test_secret';
  const body = JSON.stringify({ type: 'payment.succeeded', paymentId: 'pay-123' });
  const timestamp = 1_800_000_000;

  it('builds a timestamped HMAC-SHA256 signature using the stored signing key', () => {
    const signingKey = deriveWebhookSigningKey(secret);
    const signature = buildWebhookSignature(signingKey, timestamp, body);

    expect(signature).toBe(`t=${timestamp},v1=${signWebhookPayload(signingKey, timestamp, body)}`);
    expect(signature).toMatch(/^t=1800000000,v1=[a-f0-9]{64}$/);
  });

  it('accepts a valid signature generated from the merchant secret', () => {
    const signingKey = deriveWebhookSigningKey(secret);
    const signature = buildWebhookSignature(signingKey, timestamp, body);
    const { signature: value } = parseWebhookSignatureHeader(signature);

    expect(verifyWebhookSignature(secret, timestamp, body, value, timestamp)).toBe(true);
    expect(verifyWebhookSignatureHeader(secret, signature, body, timestamp)).toBe(true);
  });

  it('rejects a modified payload', () => {
    const signingKey = deriveWebhookSigningKey(secret);
    const signature = buildWebhookSignature(signingKey, timestamp, body);

    expect(verifyWebhookSignatureHeader(secret, signature, `${body} `, timestamp)).toBe(false);
  });

  it('rejects a stale signature outside the replay tolerance window', () => {
    const signingKey = deriveWebhookSigningKey(secret);
    const signature = buildWebhookSignature(signingKey, timestamp, body);

    expect(verifyWebhookSignatureHeader(secret, signature, body, timestamp + 301)).toBe(false);
  });

  it('rejects an invalid signature header format', () => {
    expect(() => parseWebhookSignatureHeader('invalid')).toThrow(
      'Invalid PayHarness webhook signature format',
    );
  });
});
