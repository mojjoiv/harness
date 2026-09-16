'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';
import { buildApiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';

const integrations = [
  {
    slug: 'woocommerce',
    name: 'WooCommerce',
    category: 'WordPress / WooCommerce',
    description:
      'Certified WooCommerce payment gateway package with server-side PayHarness payments, M-Pesa and PayPal support, refunds, and signed webhook synchronization.',
    status: 'Certified',
    statusTone: 'green' as const,
    steps: [
      'Download the ZIP package from this dashboard.',
      'Upload it in WordPress → Plugins → Add New → Upload Plugin.',
      'Activate PayHarness for WooCommerce and configure the gateway.',
      'Add the PayHarness webhook URL and webhook secret.',
    ],
    highlights: ['M-Pesa', 'PayPal', 'Refunds', 'Signed webhooks', 'Sandbox / Live'],
  },
  {
    slug: 'joomla',
    name: 'Joomla / VirtueMart',
    category: 'Joomla / VirtueMart',
    description:
      'Certified VirtueMart payment integration package with environment isolation, M-Pesa and PayPal support, idempotent checkout, and signed webhook state synchronization.',
    status: 'Certified',
    statusTone: 'green' as const,
    steps: [
      'Download the Joomla ZIP package from this dashboard.',
      'Install the package in Joomla → System → Install → Extensions.',
      'Enable the PayHarness VirtueMart payment and webhook plugins.',
      'Create the PayHarness payment method and configure credentials.',
    ],
    highlights: ['VirtueMart', 'M-Pesa', 'PayPal', 'Signed webhooks', 'Sandbox / Live'],
  },
];

export default function IntegrationsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');

  async function downloadIntegration(slug: string) {
    setDownloading(slug);
    setDownloadError('');

    try {
      const token = getToken();
      const response = await fetch(buildApiUrl(`/dashboard/integrations/${slug}/download`), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `payharness-${slug}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unable to download the integration package.');
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Integrations"
        description="Download certified PayHarness ecommerce packages directly from your merchant dashboard."
      />

      <Panel className="border-blue-100 bg-blue-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="blue">Ecommerce</Badge>
              <span className="text-sm font-medium text-blue-900">Production-ready integration packages</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
              Download a ZIP package, upload it to your ecommerce platform, activate it, and configure your PayHarness credentials. No GitHub access is required.
            </p>
          </div>
          <Link href="/developers">
            <Button variant="secondary">Open Developer Portal</Button>
          </Link>
        </div>
      </Panel>

      {downloadError ? (
        <Panel className="border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {downloadError}
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        {integrations.map((integration) => (
          <Panel key={integration.name} className="flex h-full flex-col p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">{integration.category}</div>
                <h2 className="mt-2 text-xl font-semibold text-ink">{integration.name}</h2>
              </div>
              <Badge tone={integration.statusTone}>{integration.status}</Badge>
            </div>

            <p className="mt-4 text-sm leading-6 text-muted">{integration.description}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {integration.highlights.map((highlight) => (
                <Badge key={highlight} tone="neutral">{highlight}</Badge>
              ))}
            </div>

            <div className="mt-6 border-t border-line pt-5">
              <h3 className="text-sm font-semibold">Installation</h3>
              <ol className="mt-3 space-y-3">
                {integration.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm leading-6 text-muted">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brandSoft text-xs font-bold text-brand">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => void downloadIntegration(integration.slug)} disabled={downloading !== null}>
                {downloading === integration.slug ? 'Preparing ZIP…' : 'Download ZIP package'}
              </Button>
              <Link href="/developers/api-keys">
                <Button variant="secondary">Manage API keys</Button>
              </Link>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold">Integration security</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-panelAlt p-4">
            <div className="text-sm font-semibold">Server-side credentials</div>
            <p className="mt-1 text-xs leading-5 text-muted">API keys and webhook secrets stay in the ecommerce server configuration.</p>
          </div>
          <div className="rounded-xl bg-panelAlt p-4">
            <div className="text-sm font-semibold">Environment isolation</div>
            <p className="mt-1 text-xs leading-5 text-muted">Sandbox and Live keys must match the selected PayHarness environment.</p>
          </div>
          <div className="rounded-xl bg-panelAlt p-4">
            <div className="text-sm font-semibold">Signed webhooks</div>
            <p className="mt-1 text-xs leading-5 text-muted">Payment state is synchronized through verified, replay-protected webhook events.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
