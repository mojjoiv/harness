import { existsSync } from 'fs';
import { resolve } from 'path';
import { integrationRoot } from './integrations.controller';

describe('integration package discovery', () => {
  const integrationsPath = resolve(__dirname, '../../../../../integrations');
  const originalPath = process.env.PAYHARNESS_INTEGRATIONS_PATH;

  beforeAll(() => {
    process.env.PAYHARNESS_INTEGRATIONS_PATH = integrationsPath;
  });

  afterAll(() => {
    if (originalPath === undefined) {
      delete process.env.PAYHARNESS_INTEGRATIONS_PATH;
      return;
    }

    process.env.PAYHARNESS_INTEGRATIONS_PATH = originalPath;
  });

  it('discovers the WooCommerce package from the configured runtime directory', () => {
    const root = integrationRoot('woocommerce');

    expect(root).toBe(resolve(integrationsPath, 'woocommerce'));
    expect(existsSync(root ?? '')).toBe(true);
  });

  it('discovers the Joomla package from the configured runtime directory', () => {
    const root = integrationRoot('joomla');

    expect(root).toBe(resolve(integrationsPath, 'joomla'));
    expect(existsSync(root ?? '')).toBe(true);
  });
});
