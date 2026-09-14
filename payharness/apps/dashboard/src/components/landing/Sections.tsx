const features = [
  {
    title: 'Unified payments',
    text: 'Give your application one payment interface while PayHarness handles provider-specific details behind it.',
  },
  {
    title: 'Reliable webhooks',
    text: 'Receive provider events with delivery tracking, retries and idempotent handling built into the payment lifecycle.',
  },
  {
    title: 'Idempotency by design',
    text: 'Protect customers and merchants from accidental duplicate payment requests.',
  },
  {
    title: 'Reconciliation',
    text: 'Keep your internal payment state aligned when providers respond late or systems temporarily disagree.',
  },
  {
    title: 'Checkout',
    text: 'Move from payment creation to a complete checkout experience without rebuilding the same flow for every provider.',
  },
  {
    title: 'A merchant dashboard',
    text: 'Monitor transactions, providers, receipts, payouts, webhooks and account settings from one place.',
  },
];

export function ProviderStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-12 gap-y-4 px-6 py-7 text-sm font-semibold text-slate-500 lg:px-8">
        <span>MPESA</span>
        <span>STRIPE</span>
        <span>PAYPAL</span>
        <span className="text-slate-400">One integration layer</span>
      </div>
    </section>
  );
}

export function Problem() {
  return (
    <section className="bg-white" id="product">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">The problem</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
            Payments get complicated fast.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Each provider brings its own API, status model, webhook behaviour and
            failure cases. PayHarness gives your team one place to build around.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            ['01', 'Connect once', 'Integrate your application with the PayHarness API instead of wiring every provider into your core business logic.'],
            ['02', 'Route payments', 'Choose the provider and payment method that fits the transaction without changing the application interface.'],
            ['03', 'Stay in sync', 'Let webhooks, retries, idempotency and reconciliation support the payment lifecycle after the initial request.'],
          ].map(([number, title, text]) => (
            <div key={number} className="border-t-2 border-[#0b1f3a] pt-5">
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

export function Features() {
  return (
    <section className="bg-[#f8fafc]" id="features">
      <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Built for the whole payment lifecycle</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
            The infrastructure around the payment matters too.
          </h2>
        </div>
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="bg-white p-7">
              <h3 className="text-lg font-semibold text-[#0b1f3a]">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">{feature.text}</p>
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
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Your application should not need to know every provider's quirks.
            </h2>
            <p className="mt-5 leading-7 text-slate-300">
              PayHarness sits between your application and payment providers,
              giving your team a consistent interface while the platform handles
              the provider-specific lifecycle.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ['Your app', 'One API request'],
              ['PayHarness', 'Routing + state'],
              ['Provider', 'Payment rail'],
            ].map(([title, text], index) => (
              <div key={title} className="relative rounded-xl border border-white/10 bg-white/[0.05] p-6">
                <span className="text-xs font-semibold text-slate-500">0{index + 1}</span>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-slate-400">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function DeveloperSection() {
  return (
    <section className="bg-white" id="developers">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 py-24 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">For developers</p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
            Build around a payment API, not a provider API.
          </h2>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-600">
            Use the API, SDKs and webhooks you already expect from modern payment
            infrastructure. Keep provider-specific logic out of your application.
          </p>
          <a href="/developers/docs" className="mt-7 inline-flex text-sm font-semibold text-[#2563eb] hover:text-[#1d4ed8]">
            Explore developer tools →
          </a>
        </div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0f172a] shadow-soft">
          <div className="border-b border-white/10 px-5 py-3 text-xs text-slate-400">Node.js</div>
          <pre className="overflow-x-auto p-6 text-sm leading-7 text-slate-200">
            <code>{`const payment = await payharness.payments.create({
  amount: 2500,
  currency: 'KES',
  provider: 'mpesa',
  reference: 'order_1042',
});

console.log(payment.id);`}</code>
          </pre>
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
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
            Use PayHarness where your business already lives.
          </h2>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            Start with the API or connect an existing commerce platform. Our
            integration layer is designed to make payment infrastructure easier to adopt.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['WooCommerce', 'WordPress commerce'],
            ['Joomla', 'CMS commerce'],
            ['Node.js', 'JavaScript SDK'],
            ['PHP', 'PHP SDK'],
            ['Python', 'Python SDK'],
            ['Go', 'Go SDK'],
            ['REST API', 'Direct integration'],
            ['Webhooks', 'Event delivery'],
          ].map(([name, description]) => (
            <div key={name} className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-semibold text-[#0b1f3a]">{name}</h3>
              <p className="mt-1 text-sm text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
