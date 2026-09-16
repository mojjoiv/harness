import Link from 'next/link';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';

const integrations = [
  {
    name: 'WooCommerce',
    category: 'WordPress / WooCommerce',
    description:
      'Native WooCommerce payment gateway with server-side PayHarness payments, M-Pesa and PayPal support, refunds, and signed webhook synchronization.',
    status: 'Certified',
    statusTone: 'green' as const,
    steps: [
      'Copy the integrations/woocommerce package into wp-content/plugins/payharness.',
      'Activate PayHarness for WooCommerce in WordPress.',
      'Configure the PayHarness API URL, API key, environment, and provider.',
      'Create the PayHarness webhook endpoint and add the webhook secret.',
    ],
    highlights: ['M-Pesa', 'PayPal', 'Refunds', 'Signed webhooks', 'Sandbox / Live'],
    docs: 'https://github.com/mojjoiv/harness/tree/main/integrations/woocommerce',
  },
  {
    name: 'Joomla / VirtueMart',
    category: 'Joomla / VirtueMart',
    description:
      'Server-side VirtueMart payment integration with environment isolation, M-Pesa and PayPal support, idempotent checkout, and signed webhook state synchronization.',
    status: 'Certified',
    statusTone: 'green' as const,
    steps: [
      'Install the PayHarness Joomla package on your Joomla site.',
      'Enable the PayHarness VirtueMart payment and webhook plugins.',
      'Create and publish a PayHarness payment method in VirtueMart.',
      'Configure the API URL, API key, environment, provider, and webhook secret.',
    ],
    highlights: ['VirtueMart', 'M-Pesa', 'PayPal', 'Signed webhooks', 'Sandbox / Live'],
    docs: 'https://github.com/mojjoiv/harness/tree/main/integrations/joomla',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        title="Integrations"
        description="Connect PayHarness to supported ecommerce platforms using certified server-side integrations."
      />

      <Panel className="border-blue-100 bg-blue-50 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone="blue">Ecommerce</Badge>
              <span className="text-sm font-medium text-blue-900">Production-ready integration packages</span>
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-900">
              Use the certified plugins to connect storefront orders to PayHarness payments while keeping API credentials and webhook secrets on the server.
            </p>
          </div>
          <Link href="/developers">
            <Button variant="secondary">Open Developer Portal</Button>
          </Link>
        </div>
      </Panel>

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
              <h3 className="text-sm font-semibold">Setup</h3>
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
              <a
                href={integration.docs}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                View integration package
              </a>
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
