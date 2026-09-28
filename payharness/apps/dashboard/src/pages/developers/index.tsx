import Link from 'next/link';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';

const nav = [
  ['Overview', '#overview'],
  ['Quickstart', '#quickstart'],
  ['Authentication', '#authentication'],
  ['Payments', '#payments'],
  ['Idempotency', '#idempotency'],
  ['Webhooks', '#webhooks'],
  ['Refunds', '#refunds'],
  ['Payouts', '#payouts'],
  ['SDKs', '#sdks'],
  ['Errors', '#errors'],
  ['Security', '#security'],
  ['Production checklist', '#production'],
];

const providers = ['M-Pesa', 'Stripe', 'PayPal', 'Pesapal', 'Flutterwave'];

const paymentExample = `curl -X POST "$PAYHARNESS_API_URL/api/v1/payments" \
  -H "Authorization: Bearer $PAYHARNESS_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: order-123-payment" \
  -d '{
    "amountCents": 10000,
    "currency": "KES",
    "environment": "SANDBOX",
    "provider": "MPESA",
    "phoneNumber": "+254700000000",
    "metadata": { "orderId": "order-123" }
  }'`;

const webhookExample = `const signature = req.headers['x-payharness-signature'];
const rawBody = req.rawBody;

// Verify the raw body before parsing or applying state changes.
const valid = verifyWebhookSignature(
  process.env.PAYHARNESS_WEBHOOK_SECRET,
  signature,
  rawBody,
);

if (!valid) return res.status(400).end();`;

const sections = [
  {
    title: 'Overview',
    description: 'Understand the integration model before writing code.',
    href: '#overview',
  },
  {
    title: 'Quickstart',
    description: 'Go from API key to your first sandbox payment.',
    href: '#quickstart',
  },
  {
    title: 'API reference',
    description: 'Payments, refunds, payouts, queries, and reconciliation.',
    href: '/developers/docs',
  },
  {
    title: 'Webhooks',
    description: 'Signed events, delivery retries, and verification.',
    href: '/developers/webhooks',
  },
  {
    title: 'API keys',
    description: 'Create sandbox/live keys and revoke credentials.',
    href: '/developers/api-keys',
  },
  {
    title: 'Usage',
    description: 'Inspect API activity, latency, and response codes.',
    href: '/developers/usage',
  },
];

export default function DeveloperPortalPage() {
  return (
    <div className="space-y-8">
      <SectionTitle
        title="Developer Portal"
        description="A complete guide to integrating PayHarness payments, webhooks, refunds, and payouts."
        action={
          <div className="flex flex-wrap gap-2">
            <Link href="/developers/docs"><Button>API Reference</Button></Link>
            <Link href="/developers/api-keys"><Button variant="secondary">API Keys</Button></Link>
          </div>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Panel className="p-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Documentation</div>
            <nav className="mt-3 space-y-1">
              {nav.map(([label, href]) => (
                <a key={href} href={href} className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panelAlt hover:text-ink">
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-5 border-t border-line pt-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Developer tools</div>
              <div className="mt-2 space-y-1">
                {sections.slice(2).map((item) => (
                  <Link key={item.title} href={item.href} className="block rounded-lg px-3 py-2 text-sm text-muted hover:bg-panelAlt hover:text-ink">
                    {item.title}
                  </Link>
                ))}
              </div>
            </div>
          </Panel>
        </aside>

        <main className="min-w-0 space-y-10">
          <section id="overview" className="scroll-mt-8">
            <Panel className="overflow-hidden p-0">
              <div className="grid gap-8 bg-slate-950 p-7 text-white lg:grid-cols-[1.25fr_0.75fr] lg:p-9">
                <div>
                  <Badge tone="blue">PayHarness API v0.1.0</Badge>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">Payments without provider-specific plumbing.</h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300">
                    PayHarness gives your backend one payment lifecycle while provider adapters handle the provider-specific work. Create a payment, persist the PayHarness resource ID, wait for verified asynchronous events, and reconcile uncertain states when necessary.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <a href="#quickstart"><Button>Start building</Button></a>
                    <Link href="/developers/docs"><Button variant="secondary">Open full reference</Button></Link>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Integration model</div>
                  <pre className="mt-4 overflow-x-auto text-xs leading-6 text-slate-200">{`Your backend
    │
    ├── PayHarness API
    │      ├── M-Pesa
    │      ├── Stripe
    │      ├── PayPal
    │      ├── Pesapal
    │      └── Flutterwave
    │
    └── Verified webhooks
           │
           └── Your order state`}</pre>
                </div>
              </div>
            </Panel>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ['One API', 'Use a consistent payment lifecycle across supported providers.'],
                ['Server-side', 'Keep API keys and provider credentials out of browser code.'],
                ['Async-safe', 'Use signed webhooks and idempotent processing for state changes.'],
                ['Recoverable', 'Query uncertain payments and reconcile provider state.'],
              ].map(([title, text]) => (
                <Panel key={title} className="p-5">
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </Panel>
              ))}
            </div>
          </section>

          <section id="quickstart" className="scroll-mt-8">
            <SectionHeading number="01" title="Quickstart" description="The shortest path from a new merchant account to a working sandbox integration." />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                ['1', 'Create a sandbox key', 'Open API Keys and generate a SANDBOX credential. Copy it immediately; the full secret is only shown at creation.'],
                ['2', 'Call the API', 'Send server-to-server requests with Authorization: Bearer and a unique Idempotency-Key for writes.'],
                ['3', 'Handle async state', 'Configure a webhook endpoint and verify signatures before updating your own order state.'],
                ['4', 'Move to live', 'Create a LIVE key only after your integration passes sandbox testing and production checks.'],
              ].map(([n, title, text]) => (
                <Panel key={n} className="p-5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brandSoft text-sm font-bold text-brand">{n}</div>
                  <h3 className="mt-4 font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{text}</p>
                </Panel>
              ))}
            </div>
          </section>

          <section id="authentication" className="scroll-mt-8">
            <SectionHeading number="02" title="Authentication & environments" description="Credentials are merchant-scoped and environment-bound." />
            <Panel className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold">API authentication</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    Send the API key in the Authorization header. Sandbox keys use the <code>ph_sandbox_</code> prefix and live keys use <code>ph_live_</code>. Never expose a live key in frontend JavaScript, mobile bundles, source control, or public logs.
                  </p>
                  <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{`Authorization: Bearer ph_sandbox_...
Content-Type: application/json`}</pre>
                </div>
                <div>
                  <h3 className="font-semibold">Environment isolation</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    An API key is locked to its environment. Do not attempt to use a sandbox credential for live traffic. Keep separate configuration values in your deployment environment.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-panelAlt p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Sandbox</div><div className="mt-1 font-mono text-sm">ph_sandbox_...</div></div>
                    <div className="rounded-xl bg-panelAlt p-4"><div className="text-xs font-semibold uppercase tracking-wide text-muted">Live</div><div className="mt-1 font-mono text-sm">ph_live_...</div></div>
                  </div>
                </div>
              </div>
            </Panel>
          </section>

          <section id="payments" className="scroll-mt-8">
            <SectionHeading number="03" title="Payments" description="Create and retrieve the canonical payment resource, then use provider-specific query operations only when needed." />
            <Panel className="p-6">
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <Badge tone="green">POST</Badge><code className="text-sm font-semibold">/api/v1/payments</code>
              </div>
              <p className="text-sm leading-6 text-muted">
                The request accepts amount in the smallest currency unit, an ISO currency code, an environment, a provider, optional customer and checkout references, metadata, and provider-specific fields such as an M-Pesa phone number.
              </p>
              <pre className="mt-5 max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-100">{paymentExample}</pre>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {providers.map((provider) => (
                  <div key={provider} className="rounded-xl border border-line p-4">
                    <div className="font-semibold">{provider}</div>
                    <p className="mt-1 text-xs leading-5 text-muted">Provider adapter behind the PayHarness payment lifecycle.</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Info title="Get payment" code="GET /api/v1/payments/:id" text="Retrieve the canonical payment resource by PayHarness ID." />
                <Info title="Query payment" code="GET /api/v1/payments/:id/query" text="Use as a controlled provider status refresh for pending or uncertain payments." />
                <Info title="Provider flows" code="POST /payments/mpesa/stk" text="Direct provider routes remain available where a provider-specific flow is required." />
              </div>
            </Panel>
          </section>

          <section id="idempotency" className="scroll-mt-8">
            <SectionHeading number="04" title="Idempotency & resource identity" description="Retries must not accidentally create duplicate financial operations." />
            <Panel className="p-6">
              <div className="grid gap-4 md:grid-cols-3">
                <Info title="Order reference" code="order-123" text="Your application's stable business identifier. Keep it in your own database and/or metadata." />
                <Info title="Idempotency key" code="order-123-payment" text="Stable identity for one logical write and its retries. Send it in Idempotency-Key." />
                <Info title="PayHarness ID" code="payment_..." text="Canonical payment/resource identifier returned by PayHarness. Store it with your order." />
              </div>
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Generate an idempotency identity from your business operation, not from a random value generated for every retry. Reuse the same key when safely retrying the same logical request.
              </div>
            </Panel>
          </section>

          <section id="webhooks" className="scroll-mt-8">
            <SectionHeading number="05" title="Webhooks" description="Webhooks are how your application learns about asynchronous payment state changes." />
            <Panel className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="font-semibold">Verification flow</h3>
                  <ol className="mt-3 space-y-3 text-sm leading-6 text-muted">
                    <li><strong className="text-ink">1. Capture</strong> — preserve the exact raw HTTP request body.</li>
                    <li><strong className="text-ink">2. Verify</strong> — validate the PayHarness signature before parsing or changing state.</li>
                    <li><strong className="text-ink">3. Deduplicate</strong> — make your event handler idempotent.</li>
                    <li><strong className="text-ink">4. Apply</strong> — update the order/payment state only after verification.</li>
                    <li><strong className="text-ink">5. Acknowledge</strong> — return a successful response after the event is safely handled.</li>
                  </ol>
                </div>
                <div>
                  <h3 className="font-semibold">Verification example</h3>
                  <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{webhookExample}</pre>
                </div>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <Info title="Configure" code="/developers/webhooks" text="Create endpoints, select events, test deliveries, rotate secrets, and inspect failures." />
                <Info title="Retry safely" code="delivery retry" text="Webhook delivery is operationally retriable; your handler must still be idempotent." />
                <Info title="Provider callbacks" code="/webhooks/provider/:provider/:merchantId" text="Provider callbacks are verified and normalized by PayHarness before merchant delivery." />
              </div>
            </Panel>
          </section>

          <section id="refunds" className="scroll-mt-8">
            <SectionHeading number="06" title="Refunds" description="Refunds are server-side operations and require an authenticated merchant context." />
            <Panel className="p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="green">POST</Badge><code className="text-sm font-semibold">/api/v1/payments/:id/refund</code>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">Send an optional amountCents for a partial refund. Omit it when your integration intends a full refund. Supply an Idempotency-Key for safe retries.</p>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{`curl -X POST "$PAYHARNESS_API_URL/api/v1/payments/payment_123/refund" \
  -H "Authorization: Bearer $PAYHARNESS_API_KEY" \
  -H "Idempotency-Key: order-123-refund-1" \
  -H "Content-Type: application/json" \
  -d '{"amountCents": 2500}'`}</pre>
              <p className="mt-4 text-xs leading-5 text-muted">Refund access is restricted to merchant OWNER and ADMIN roles.</p>
            </Panel>
          </section>

          <section id="payouts" className="scroll-mt-8">
            <SectionHeading number="07" title="Payouts" description="Payout creation is idempotent; execution and reconciliation are controlled operations." />
            <Panel className="p-6">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['POST /payouts', 'Create a payout. Idempotency-Key is required.'],
                  ['GET /payouts', 'List merchant payouts with pagination.'],
                  ['GET /payouts/:id', 'Retrieve one payout by its canonical ID.'],
                  ['POST /payouts/:id/execute', 'Execute a previously created payout.'],
                  ['GET /payouts/report', 'Generate a merchant payout report.'],
                  ['POST /payouts/reconciliation/run', 'Run stale-payout reconciliation as an OWNER or ADMIN.'],
                ].map(([code, text]) => <div key={code} className="rounded-xl border border-line p-4"><code className="text-xs font-semibold">{code}</code><p className="mt-1 text-sm leading-5 text-muted">{text}</p></div>)}
              </div>
            </Panel>
          </section>

          <section id="sdks" className="scroll-mt-8">
            <SectionHeading number="08" title="Official SDKs & integration resources" description="Use an SDK where it reduces boilerplate, but keep the same security and lifecycle rules as direct HTTP calls." />
            <Panel className="p-6">
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  ['Node.js', 'npm install @payharness/sdk-js'],
                  ['PHP', 'composer require payharness/sdk-php'],
                  ['Python', 'pip install payharness'],
                  ['Go', 'go get github.com/mojjoiv/harness/payharness/packages/sdk-go'],
                ].map(([name, command]) => <div key={name} className="rounded-xl bg-panelAlt p-4"><div className="font-semibold">{name}</div><code className="mt-3 block overflow-x-auto text-xs">{command}</code></div>)}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Link href="/developers/docs"><Button variant="secondary">Full API reference</Button></Link>
                <Link href="/developers/webhooks"><Button variant="secondary">Webhook tools</Button></Link>
                <Link href="/developers/usage"><Button variant="secondary">Usage</Button></Link>
              </div>
            </Panel>
          </section>

          <section id="errors" className="scroll-mt-8">
            <SectionHeading number="09" title="Errors & debugging" description="Treat non-2xx responses as actionable API errors and preserve enough context to troubleshoot without logging secrets." />
            <Panel className="p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Info title="400 Bad Request" code="Invalid request" text="Check required fields, enum values, amount/currency normalization, environment, and provider-specific requirements." />
                <Info title="401 Unauthorized" code="Authentication" text="Check the API key, Authorization header, environment binding, and whether the key has been revoked." />
                <Info title="403 Forbidden" code="Authorization" text="Check the merchant role and whether the operation is restricted to OWNER or ADMIN." />
                <Info title="409 / idempotency" code="Conflict" text="Reuse the original idempotency identity only for the same logical operation; investigate mismatched request parameters." />
                <Info title="5xx / provider uncertainty" code="Retry carefully" text="Do not blindly create a second payment. Retrieve/query the existing PayHarness resource and use webhook/reconciliation state." />
                <Info title="Webhook failure" code="Inspect delivery" text="Use the Webhooks page to inspect attempts, response codes, response bodies, failure reasons, and retry a failed delivery." />
              </div>
            </Panel>
          </section>

          <section id="security" className="scroll-mt-8">
            <SectionHeading number="10" title="Security" description="The integration boundary is part of your payment security model." />
            <Panel className="p-6">
              <ul className="grid gap-3 text-sm leading-6 text-muted md:grid-cols-2">
                {[
                  'Never expose ph_live_ credentials to browsers, mobile apps, repositories, screenshots, or client logs.',
                  'Store webhook secrets as server-side secrets and rotate them if they are exposed.',
                  'Verify the exact raw webhook body before parsing or applying payment state.',
                  'Make webhook processing idempotent because delivery can be retried.',
                  'Keep PayHarness resource IDs, business order references, and idempotency keys as separate fields.',
                  'Use sandbox credentials and test outcomes before enabling live payment traffic.',
                  'Do not log Authorization headers, API keys, webhook secrets, or provider credentials.',
                  'Use query/reconciliation as a controlled recovery mechanism for uncertain asynchronous states.',
                ].map((item) => <li key={item} className="rounded-xl border border-line p-4">• {item}</li>)}
              </ul>
            </Panel>
          </section>

          <section id="production" className="scroll-mt-8">
            <SectionHeading number="11" title="Production checklist" description="Run through this list before switching an integration from sandbox to live." />
            <Panel className="border-emerald-200 bg-emerald-50 p-6">
              <ul className="space-y-2 text-sm leading-6 text-emerald-900">
                <li>✓ Live API key is stored only in the server environment.</li>
                <li>✓ Payment IDs are persisted alongside internal order IDs.</li>
                <li>✓ Idempotency keys are stable across retries of the same write.</li>
                <li>✓ Webhook signatures are verified against the raw body.</li>
                <li>✓ Webhook handlers are idempotent and tolerate retries.</li>
                <li>✓ Pending/uncertain payments have a query or reconciliation path.</li>
                <li>✓ Refunds and payouts are protected by your own authorization/business rules.</li>
                <li>✓ Provider credentials and webhook secrets are not present in client bundles or logs.</li>
              </ul>
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="mb-4">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{number}</div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function Info({ title, code, text }: { title: string; code: string; text: string }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="font-semibold">{title}</div>
      <code className="mt-2 block overflow-x-auto text-xs">{code}</code>
      <p className="mt-2 text-sm leading-5 text-muted">{text}</p>
    </div>
  );
}
