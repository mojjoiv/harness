const features = [
  { title: 'Unified payments', text: 'Give your application one payment interface while PayHarness handles provider-specific details behind it.' },
  { title: 'Reliable webhooks', text: 'Receive provider events with delivery tracking, retries and idempotent handling built into the payment lifecycle.' },
  { title: 'Idempotency by design', text: 'Protect customers and merchants from accidental duplicate payment requests.' },
  { title: 'Reconciliation', text: 'Keep your internal payment state aligned when providers respond late or systems temporarily disagree.' },
  { title: 'Checkout', text: 'Move from payment creation to a complete checkout experience without rebuilding the same flow for every provider.' },
  { title: 'Merchant dashboard', text: 'Monitor transactions, providers, receipts, payouts, webhooks and account settings from one place.' },
];

export function ProviderStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 py-7 text-sm font-semibold text-slate-500 lg:px-8">
        <span>STRIPE</span><span>PAYPAL</span><span>MPESA</span><span className="text-slate-400">One integration layer</span>
      </div>
    </section>
  );
}

export function SocialProof() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-8">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-6 sm:flex sm:items-center sm:justify-between sm:gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Built for real products</p>
            <p className="mt-2 text-base font-medium text-[#0b1f3a]">From SaaS and ecommerce to marketplaces and online services.</p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 sm:mt-0">
            {['SaaS', 'Ecommerce', 'Marketplaces', 'Travel & services'].map((item) => (
              <span key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{item}</span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Problem() {
  return (
    <section className="bg-white" id="product">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Why businesses choose a payment layer</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">Payments shouldn't become your engineering team's permanent side project.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Every provider has different APIs, statuses, webhooks and failure cases. PayHarness gives your team a consistent layer so you can focus on your product and your customers.
          </p>
        </div>
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            ['01', 'Connect once', 'Integrate your application with one payment API instead of wiring every provider into your core business logic.'],
            ['02', 'Keep your experience', 'Use hosted checkout or your own customer journey while PayHarness handles the payment infrastructure underneath.'],
            ['03', 'Stay in sync', 'Use webhooks, retries, idempotency and reconciliation to support the payment lifecycle after the initial request.'],
          ].map(([number, title, text]) => (
            <div key={number} className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
              <span className="text-xs font-semibold text-slate-400">{number}</span>
              <h3 className="mt-3 text-xl font-semibold text-[#0b1f3a]">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Solutions() {
  const solutions = [
    ['SaaS & software', 'Accept one-time and recurring payments while keeping payment-provider logic out of your product.'],
    ['Ecommerce', 'Give customers more payment choices without maintaining a separate integration for every provider.'],
    ['Marketplaces', 'Build payment flows around your orders, users and merchants with a consistent payment lifecycle.'],
    ['Travel & services', 'Make it easier for customers at home and abroad to pay for bookings, services and experiences.'],
  ];
  return (
    <section id="solutions" className="bg-[#f8fafc]">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Built around your business</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">A payment stack that fits the way you sell.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Whether you're launching a SaaS product or processing bookings, PayHarness is designed to sit behind your customer experience.</p>
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {solutions.map(([title, text]) => (
            <article key={title} className="group rounded-2xl border border-slate-200 bg-white p-7 transition hover:-translate-y-1 hover:shadow-lg">
              <h3 className="text-xl font-semibold text-[#0b1f3a]">{title}</h3>
              <p className="mt-3 leading-7 text-slate-600">{text}</p>
              <span className="mt-6 inline-flex text-sm font-semibold text-[#2563eb]">See how it fits →</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PaymentFlow() {
  return (
    <section className="bg-[#0b1f3a] text-white">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">One payment layer</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Your application should not need to know every provider's quirks.</h2>
            <p className="mt-5 leading-7 text-slate-300">PayHarness sits between your application and payment providers, giving your team a consistent interface while the platform handles the provider-specific lifecycle.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[['Your app', 'One API request'], ['PayHarness', 'Routing + state'], ['Provider', 'Payment rail']].map(([title, text], index) => (
              <div key={title} className="relative rounded-xl border border-white/10 bg-white/[0.05] p-6">
                <span className="text-xs font-semibold text-slate-500">0{index + 1}</span>
                <h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function Features() {
  return (
    <section className="bg-white" id="features">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">What you get</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">Everything around the payment, not just the button.</h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => <article key={feature.title} className="bg-white p-7"><h3 className="text-lg font-semibold text-[#0b1f3a]">{feature.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p></article>)}
        </div>
      </div>
    </section>
  );
}

export function DeveloperSection() {
  return (
    <section className="bg-[#f8fafc]" id="developers">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">For developers</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">A clean API for the team that has to build it.</h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">Your developers get a consistent payment interface, signed webhooks, idempotency, reconciliation tools and a dedicated developer portal.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="/developers" className="inline-flex rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1d4ed8]">Open developer portal</a>
            <a href="/developers/docs" className="inline-flex rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400">Read API docs</a>
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0f172a] shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
          <div className="border-b border-white/10 px-5 py-3 text-xs text-slate-400">Node.js · one integration</div>
          <pre className="overflow-x-auto p-6 text-sm leading-7 text-slate-200"><code>{`const payment = await payharness.payments.create({
  amount: 25000,
  currency: 'KES',
  provider: 'stripe',
  reference: 'order_1042',
});

console.log(payment.id);`}</code></pre>
        </div>
      </div>
    </section>
  );
}

export function Integrations() {
  return (
    <section className="border-y border-slate-200 bg-slate-50" id="integrations">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Integrations</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">Meet your business where it already works.</h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">Start with the API, use the developer tools, and expand into the commerce stack as your needs grow.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Stripe', 'International cards'], ['PayPal', 'Global wallet'], ['M-Pesa', 'Local payment rail'], ['REST API', 'Direct integration'],
            ['Node.js', 'JavaScript'], ['PHP', 'PHP applications'], ['Python', 'Python applications'], ['Webhooks', 'Event delivery'],
          ].map(([name, description]) => <div key={name} className="rounded-xl border border-slate-200 bg-white p-5"><h3 className="font-semibold text-[#0b1f3a]">{name}</h3><p className="mt-1 text-sm text-slate-500">{description}</p></div>)}
        </div>
      </div>
    </section>
  );
}

export function FAQ() {
  const items = [
    ['Do I need to rebuild my checkout?', 'No. PayHarness can provide hosted checkout, while teams that need more control can integrate directly through the API.'],
    ['Can I keep my existing payment providers?', 'PayHarness is designed as an integration layer, so your payment architecture can support multiple providers without putting provider-specific logic throughout your application.'],
    ['Is PayHarness only for developers?', 'No. Developers get the API and tools, while business teams get a dashboard for transactions, providers and payment operations.'],
    ['Can I test before going live?', 'PayHarness provides sandbox-oriented developer workflows so you can build and test an integration before moving to production.'],
  ];
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-4xl px-6 py-24 lg:px-8">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Questions</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">Before you connect, here's what to know.</h2>
        </div>
        <div className="mt-12 divide-y divide-slate-200 rounded-2xl border border-slate-200">
          {items.map(([question, answer]) => (
            <details key={question} className="group p-6">
              <summary className="cursor-pointer list-none pr-8 text-base font-semibold text-[#0b1f3a]">{question}</summary>
              <p className="mt-3 max-w-3xl leading-7 text-slate-600">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
