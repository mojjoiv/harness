import fs from 'node:fs';
import path from 'node:path';

describe('Merchant onboarding UI certification', () => {
  const srcRoot = path.resolve(__dirname, '..');

  it('exposes the merchant setup checklist and navigation', () => {
    const page = fs.readFileSync(path.join(srcRoot, 'pages', 'onboarding.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(srcRoot, 'components', 'layout.tsx'), 'utf8');

    expect(page).toContain('Merchant setup');
    expect(page).toContain('Account approved');
    expect(page).toContain('Complete business profile');
    expect(page).toContain('Connect a sandbox payment provider');
    expect(page).toContain('Create a sandbox API key');
    expect(page).toContain('Configure a webhook endpoint');
    expect(page).toContain('Configure checkout return URLs');
    expect(page).toContain('Verify a live payment provider');
    expect(page).toContain('Create a live API key');
    expect(page).toContain('/merchant/onboarding');
    expect(layout).toContain("label: 'Get Started'");
    expect(layout).toContain("href: '/onboarding'");
  });
});
