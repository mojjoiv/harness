import { createHash, createHmac, timingSafeEqual } from 'crypto';

export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export interface WebhookSignatureParts {
  timestamp: number;
  signature: string;
}

export function deriveWebhookSigningKey(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function signWebhookPayload(secretOrSigningKey: string, timestamp: number, body: string): string {
  return createHmac('sha256', secretOrSigningKey)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}

export function buildWebhookSignature(secretOrSigningKey: string, timestamp: number, body: string): string {
  return `t=${timestamp},v1=${signWebhookPayload(secretOrSigningKey, timestamp, body)}`;
}

export function parseWebhookSignatureHeader(header: string): WebhookSignatureParts {
  const values = new Map(
    header.split(',').map((part) => {
      const [key, ...value] = part.split('=');
      return [key?.trim(), value.join('=').trim()] as const;
    }),
  );

  const timestamp = Number(values.get('t'));
  const signature = values.get('v1');
  if (!Number.isInteger(timestamp) || !signature) {
    throw new Error('Invalid PayHarness webhook signature format');
  }

  return { timestamp, signature };
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: number,
  body: string,
  expectedSignature: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const signingKey = deriveWebhookSigningKey(secret);
  const expected = signWebhookPayload(signingKey, timestamp, body);
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const receivedBuffer = Buffer.from(expectedSignature, 'utf8');

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function verifyWebhookSignatureHeader(
  secret: string,
  header: string,
  body: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS,
): boolean {
  const { timestamp, signature } = parseWebhookSignatureHeader(header);
  return verifyWebhookSignature(secret, timestamp, body, signature, nowSeconds, toleranceSeconds);
}
