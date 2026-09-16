import { existsSync } from 'fs';
import { resolve } from 'path';
import { integrationRoot } from './integrations.controller';

describe('integration package discovery', () => {
  const integrationsPath = resolve(__dirname, '../../../../../integrations');
  const originalPath = process.env.PAYHARNESS_INTEGRATIONS_PATH;

  afterEach(() => {
    if (originalPath === undefined) {
      delete process.env.PAYHARNESS_INTEGRATIONS_PATH;
      return;
    }

    process.env.PAYHARNESS_INTEGRATIONS_PATH = originalPath;
  });

  it('discovers the WooCommerce package from the configured runtime directory', () => {
    process.env.PAYHARNESS_INTEGRATIONS_PATH = integrationsPath;
    const root = integrationRoot('woocommerce');

    expect(root).toBe(resolve(integrationsPath, 'woocommerce'));
    expect(existsSync(root ?? '')).toBe(true);
  });

  it('discovers the Joomla package from the configured runtime directory', () => {
    process.env.PAYHARNESS_INTEGRATIONS_PATH = integrationsPath;
    const root = integrationRoot('joomla');

    expect(root).toBe(resolve(integrationsPath, 'joomla'));
    expect(existsSync(root ?? '')).toBe(true);
  });

  it('discovers WooCommerce from the Render Node service repository root fallback', () => {
    delete process.env.PAYHARNESS_INTEGRATIONS_PATH;
    const root = integrationRoot('woocommerce');
    const expected = resolve(process.cwd(), '..', '..', '..', 'integrations', 'woocommerce');

    expect(root).toBe(expected);
    expect(existsSync(root ?? '')).toBe(true);
  });

  it('discovers Joomla from the Render Node service repository root fallback', () => {
    delete process.env.PAYHARNESS_INTEGRATIONS_PATH;
    const root = integrationRoot('joomla');
    const expected = resolve(process.cwd(), '..', '..', '..', 'integrations', 'joomla');

    expect(root).toBe(expected);
    expect(existsSync(root ?? '')).toBe(true);
  });
});
