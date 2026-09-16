import fs from 'node:fs';
import path from 'node:path';

describe('Ecommerce integrations UI certification', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const readPage = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, 'pages', relativePath), 'utf8');

  it('exposes the integrations page and merchant navigation entry', () => {
    const page = readPage('integrations.tsx');
    const layout = fs.readFileSync(path.join(srcRoot, 'components', 'layout.tsx'), 'utf8');

    expect(page).toContain('Integrations');
    expect(page).toContain('WooCommerce');
    expect(page).toContain('Joomla / VirtueMart');
    expect(page).toContain('Certified');
    expect(page).toContain('/developers/api-keys');
    expect(layout).toContain("{ label: 'Integrations', href: '/integrations', exact: true }");
  });

  it('keeps the certified ecommerce capabilities visible', () => {
    const page = readPage('integrations.tsx');

    expect(page).toContain('M-Pesa');
    expect(page).toContain('PayPal');
    expect(page).toContain('Signed webhooks');
    expect(page).toContain('Sandbox / Live');
    expect(page).toContain('Refunds');
    expect(page).toContain('VirtueMart');
  });
});
