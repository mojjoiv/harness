import Link from 'next/link';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';

const sdks = [
  { name: 'Node.js', command: 'npm install @payharness/sdk-js', href: '/developers/docs' },
  { name: 'PHP', command: 'composer require payharness/sdk-php', href: '/developers/docs' },
  { name: 'Python', command: 'pip install payharness', href: '/developers/docs' },
  { name: 'Go', command: 'go get github.com/mojjoiv/harness/payharness/packages/sdk-go', href: '/developers/docs' },
];

const resources = [
  {
    title: 'API Keys',
    description: 'Create environment-bound sandbox and live credentials for server-to-server integrations.',
    href: '/developers/api-keys',
    label: 'Manage keys',
  },
  {
    title: 'Webhooks',
    description: 'Configure signed endpoints, test deliveries, rotate secrets, and inspect delivery history.',
    href: '/developers/webhooks',
    label: 'Manage webhooks',
  },
  {
    title: 'Usage',
    description: 'Inspect authenticated API requests, response codes, latency, and request activity.',
    href: '/developers/usage',
    label: 'View usage',
  },
  {
    title: 'API Reference',
    description: 'Work through authentication, payments, refunds, payouts, idempotency, and webhook security.',
    href: '/developers/docs',
    label: 'Open docs',
  },
];

const flow = [
  ['1', 'Create a sandbox key', 'Generate a ph_sandbox_... credential and keep it on your server.'],
  ['2', 'Build your payment flow', 'Create payments with stable order references and idempotency identities.'],
  ['3', 'Verify webhooks', 'Use the signed webhook helpers in your SDK or verify the raw request yourself.'],
  ['4', 'Go live', 'Create a ph_live_... key only when your integration is ready for production.'],
];

export default function DeveloperPortalPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        title="Developer Portal"
        description="Everything you need to build, test, secure, and operate a PayHarness integration."
        action={
          <Link href="/developers/docs">
            <Button>Read API docs</Button>
          </Link>
        }
      />

      <Panel className="overflow-hidden p-0">
        <div className="grid gap-8 bg-slate-950 p-6 text-white lg:grid-cols-[1.3fr_0.7fr] lg:p-8">
          <div>
            <Badge tone="blue">API v0.1.0</Badge>
            <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Build once. Orchestrate payments everywhere.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              Use one payment lifecycle across M-Pesa, Stripe, and PayPal. Keep API keys server-side, use stable idempotency identities, and let verified webhooks drive asynchronous state changes.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/developers/docs"><Button>Start with the API</Button></Link>
              <Link href="/developers/api-keys"><Button variant="secondary">Create sandbox key</Button></Link>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Recommended architecture</div>
            <pre className="mt-4 overflow-x-auto text-xs leading-6 text-slate-200">{`Your server\n   │\n   ├── PayHarness API\n   │      ├── M-Pesa\n   │      ├── Stripe\n   │      └── PayPal\n   │\n   └── Signed webhook\n          │\n          └── Your order state`}</pre>
          </div>
        </div>
      </Panel>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Developer workspace</h2>
          <p className="mt-1 text-sm text-muted">Your existing developer controls, now organized around one integration workflow.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {resources.map((resource) => (
            <Panel key={resource.href} className="flex h-full flex-col p-5">
              <h3 className="font-semibold">{resource.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{resource.description}</p>
              <Link href={resource.href} className="mt-5 text-sm font-semibold text-brand hover:underline">{resource.label} →</Link>
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Quickstart</h2>
          <p className="mt-1 text-sm text-muted">Follow the same sequence for custom apps and ecommerce integrations.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {flow.map(([number, title, description]) => (
            <Panel key={number} className="p-5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brandSoft text-sm font-bold text-brand">{number}</div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
            </Panel>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Official SDKs</h2>
          <p className="mt-1 text-sm text-muted">Use the typed clients for payments, refunds, payouts, idempotency, and webhook verification.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {sdks.map((sdk) => (
            <Panel key={sdk.name} className="p-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{sdk.name}</h3>
                <Badge tone="green">SDK</Badge>
              </div>
              <code className="mt-4 block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 text-xs text-slate-100">{sdk.command}</code>
              <Link href={sdk.href} className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">View SDK guide →</Link>
            </Panel>
          ))}
        </div>
      </section>

      <Panel className="p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h2 className="text-lg font-semibold">Security rules that matter</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted">
              <li>• Never expose ph_live_... API keys in browser or mobile application code.</li>
              <li>• Preserve the exact raw webhook body before signature verification.</li>
              <li>• Reject stale webhook timestamps and process webhook events idempotently.</li>
              <li>• Keep the PayHarness resource ID separate from your idempotency key and order reference.</li>
            </ul>
          </div>
          <Link href="/developers/docs"><Button variant="secondary">Read security guide</Button></Link>
        </div>
      </Panel>
    </div>
  );
}
