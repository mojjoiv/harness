import * as http from 'http';
import { MpesaWebhookVerifierService } from './mpesa-webhook-verifier.service';

describe('MpesaWebhookVerifierService', () => {
  let service: MpesaWebhookVerifierService;

  beforeEach(() => {
    service = new MpesaWebhookVerifierService();
  });

  it('rejects an invalid callback URL without throwing', async () => {
    const result = await service.verify('not-a-url', 'correlation-1');

    expect(result).toEqual(expect.objectContaining({
      reachable: false,
      error: 'Invalid callback URL',
      requestUrl: 'not-a-url',
    }));
  });

  it('reports a reachable HTTP endpoint and preserves the response body', async () => {
    const server = http.createServer((_req, res) => {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Test server did not expose a port');

    try {
      const result = await service.verify(`http://127.0.0.1:${address.port}/callback`, 'correlation-2');

      expect(result.reachable).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.responseBody).toContain('ok');
      expect(result.latencyMs).toEqual(expect.any(Number));
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});
