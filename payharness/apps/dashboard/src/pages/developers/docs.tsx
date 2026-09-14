import Link from 'next/link';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';

const endpoints = [
  ['POST', '/payments', 'Create a payment from your server. Use a stable Idempotency-Key for retryable operations.'],
  ['GET', '/payments/:id', 'Retrieve the canonical PayHarness payment resource.'],
  ['GET', '/payments/:id/query', 'Controlled provider status refresh for pending or uncertain payments.'],
  ['POST', '/payments/:id/refund', 'Create a full or partial refund for a payment.'],
  ['GET', '/payouts', 'List merchant payouts with pagination.'],
  ['POST', '/payouts', 'Create a payout with a stable idempotency identity.'],
  ['POST', '/payouts/:id/execute', 'Execute a previously created payout.'],
];

const snippets = {
  curl: `curl -X POST "$PAYHARNESS_API_URL/payments" \\\n  -H "Authorization: Bearer $PAYHARNESS_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -H "Idempotency-Key: order-123-payment" \\\n  -d '{
    "amountCents": 10000,
    "currency": "KES",
    "provider": "MPESA",
    "metadata": { "orderId": "order-123" }
  }'`,
  webhook: `const signature = request.headers['x-payharness-signature'];
const rawBody = request.rawBody;

// Verify before parsing or applying business changes.
const valid = verifyWebhookSignature(
  process.env.PAYHARNESS_WEBHOOK_SECRET,
  signature,
  rawBody,
);

if (!valid) return response.status(400).end();`,
};

export default function DeveloperDocsPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        title="API documentation"
        description="Server-to-server integration reference for PayHarness API v0.1.0."
        action={
          <Link href="/developers">
            <Button variant="secondary">Back to portal</Button>
          </Link>
        }
      />

      <Panel className="p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="blue">API v0.1.0</Badge>
          <span className="text-sm text-muted">Base URL is environment-configurable.</span>
        </div>
        <h2 className="mt-4 text-xl font-semibold">Authentication</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          Merchant integrations use a server-side API key in the Authorization header. Sandbox keys start with <code>ph_sandbox_</code>; live keys start with <code>ph_live_</code>. Never place a live key in browser JavaScript, mobile bundles, or public repositories.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{`Authorization: Bearer ph_live_...
X-PayHarness-Api-Version: 0.1.0`}</pre>
      </Panel>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Common endpoints</h2>
          <p className="mt-1 text-sm text-muted">Use the resource ID returned by PayHarness as the canonical payment or payout identifier.</p>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-soft">
          {endpoints.map(([method, path, description]) => (
            <div key={`${method}-${path}`} className="grid gap-3 border-b border-line p-4 last:border-b-0 md:grid-cols-[90px_260px_1fr] md:items-center">
              <Badge tone={method === 'GET' ? 'blue' : 'green'}>{method}</Badge>
              <code className="text-sm font-semibold">{path}</code>
              <p className="text-sm leading-6 text-muted">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel className="p-6">
          <h2 className="text-lg font-semibold">Create a payment</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Keep your order reference in metadata and reuse the same logical idempotency identity when retrying an uncertain request.</p>
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{snippets.curl}</pre>
        </Panel>
        <Panel className="p-6">
          <h2 className="text-lg font-semibold">Webhook verification</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Verify the exact raw body before parsing it. The signed header uses <code>t=&lt;timestamp&gt;,v1=&lt;digest&gt;</code> and a five-minute replay tolerance.</p>
          <pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{snippets.webhook}</pre>
          <Link href="/developers/webhooks" className="mt-4 inline-block text-sm font-semibold text-brand hover:underline">Configure webhook endpoints →</Link>
        </Panel>
      </section>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold">Idempotency and resource identity</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-panelAlt p-4"><div className="text-sm font-semibold">Order reference</div><p className="mt-1 text-xs leading-5 text-muted">Your application's stable order or transaction reference.</p></div>
          <div className="rounded-xl bg-panelAlt p-4"><div className="text-sm font-semibold">Idempotency key</div><p className="mt-1 text-xs leading-5 text-muted">Stable identity for one logical write operation and its retries.</p></div>
          <div className="rounded-xl bg-panelAlt p-4"><div className="text-sm font-semibold">PayHarness resource ID</div><p className="mt-1 text-xs leading-5 text-muted">Canonical internal payment, refund, or payout identifier returned by PayHarness.</p></div>
        </div>
      </Panel>

      <Panel className="p-6">
        <h2 className="text-lg font-semibold">Official SDKs</h2>
        <p className="mt-2 text-sm leading-6 text-muted">The Node.js, PHP, Python, and Go SDKs provide typed clients plus webhook signature helpers. Keep SDK credentials server-side just like direct API credentials.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <code className="rounded-xl bg-panelAlt px-4 py-3 text-xs">npm install @payharness/sdk-js</code>
          <code className="rounded-xl bg-panelAlt px-4 py-3 text-xs">composer require payharness/sdk-php</code>
          <code className="rounded-xl bg-panelAlt px-4 py-3 text-xs">pip install payharness</code>
          <code className="rounded-xl bg-panelAlt px-4 py-3 text-xs">go get github.com/mojjoiv/harness/payharness/packages/sdk-go</code>
        </div>
      </Panel>

      <Panel className="border-amber-200 bg-amber-50 p-6">
        <h2 className="text-lg font-semibold text-amber-950">Production checklist</h2>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-amber-900">
          <li>• Use ph_live_... only on trusted servers.</li>
          <li>• Store the PayHarness payment ID alongside your order ID.</li>
          <li>• Verify webhook signatures before changing payment state.</li>
          <li>• Apply webhook event idempotency in your application.</li>
          <li>• Use webhooks as the source of truth for asynchronous payment state.</li>
          <li>• Use query/reconciliation as a controlled fallback for uncertain states.</li>
        </ul>
      </Panel>
    </div>
  );
}
