import fs from 'node:fs';
import path from 'node:path';

describe('Developer Portal UI certification', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const pagesRoot = path.join(srcRoot, 'pages');

  const readPage = (relativePath: string) =>
    fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');

  it('keeps the Developer Portal workspace and navigation contracts', () => {
    const portal = readPage('developers/index.tsx');
    const layout = fs.readFileSync(
      path.join(srcRoot, 'components', 'layout.tsx'),
      'utf8',
    );

    expect(portal).toContain('Developer Portal');
    expect(portal).toContain('/developers/api-keys');
    expect(portal).toContain('/developers/webhooks');
    expect(portal).toContain('/developers/usage');
    expect(portal).toContain('/developers/docs');
    expect(portal).toContain('Quickstart');
    expect(portal).toContain('Official SDKs');
    expect(layout).toContain('/developers');
    expect(layout).toContain('Developer Portal');
  });

  it('keeps API keys, usage, webhooks, and API reference surfaces intact', () => {
    const apiKeys = readPage('developers/api-keys.tsx');
    const usage = readPage('developers/usage.tsx');
    const webhooks = readPage('developers/webhooks.tsx');
    const docs = readPage('developers/docs.tsx');

    expect(apiKeys).toContain('API Keys');
    expect(apiKeys.toLowerCase()).toContain('sandbox');
    expect(apiKeys.toLowerCase()).toContain('live');

    expect(usage).toContain('Usage');

    expect(webhooks).toContain('Webhooks');
    expect(webhooks.toLowerCase()).toContain('signature');
    expect(webhooks.toLowerCase()).toContain('delivery');

    expect(docs).toContain('API Reference');
    expect(docs).toContain('POST /payments');
    expect(docs.toLowerCase()).toContain('idempotency');
    expect(docs.toLowerCase()).toContain('webhook');
  });
});
