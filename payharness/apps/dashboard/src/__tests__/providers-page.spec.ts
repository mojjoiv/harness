import fs from 'node:fs';
import path from 'node:path';

describe('Providers page Flutterwave UI', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const readPage = () =>
    fs.readFileSync(path.join(srcRoot, 'pages', 'providers', 'index.tsx'), 'utf8');

  it('shows Flutterwave as a configurable provider', () => {
    const page = readPage();

    expect(page).toContain('Flutterwave');
    expect(page).toContain('Save Flutterwave');
    expect(page).toContain("register('publicKey')");
    expect(page).toContain("register('secretKey')");
    expect(page).toContain("register('secretHash')");
  });

  it('uses the existing provider credentials endpoint and environment model', () => {
    const page = readPage();

    expect(page).toContain("/provider-credentials/flutterwave");
    expect(page).toContain('SANDBOX');
    expect(page).toContain('LIVE');
    expect(page).toContain("publicConfig: { publicKey: values.publicKey }");
    expect(page).toContain("secretConfig: { secretKey: values.secretKey, secretHash: values.secretHash || undefined }");
  });

  it('renders Flutterwave credentials returned by the API with the correct display name', () => {
    const page = readPage();

    expect(page).toContain("provider === 'FLUTTERWAVE' ? 'Flutterwave'");
    expect(page).toContain('displayProviderName(credential.provider)');
  });
});
