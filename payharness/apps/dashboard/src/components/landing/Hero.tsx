export function Hero() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-28">
        <div>
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">
            Payment infrastructure for modern businesses
          </p>
          <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-[-0.04em] text-[#0b1f3a] sm:text-6xl lg:text-7xl">
            Payments without the provider headache.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Accept payments, manage transactions, handle webhooks and keep your
            payment state in sync through one reliable platform.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="/register"
              className="rounded-lg bg-[#2563eb] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
            >
              Start building
            </a>
            <a
              href="#developers"
              className="rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
            >
              Read the docs
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-500">
            <span>One API</span>
            <span>•</span>
            <span>M-Pesa</span>
            <span>•</span>
            <span>Stripe</span>
            <span>•</span>
            <span>PayPal</span>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.13),transparent_65%)]" />
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0b1f3a] shadow-[0_24px_70px_rgba(11,31,58,0.18)]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 text-xs text-slate-400">
              <span>POST /payments</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-slate-300">201 Created</span>
            </div>
            <pre className="overflow-x-auto p-6 text-sm leading-7 text-slate-200">
              <code>{`{
  "amount": 2500,
  "currency": "KES",
  "provider": "mpesa",
  "customer": {
    "phone": "+254700000000"
  }
}`}</code>
            </pre>
            <div className="border-t border-white/10 bg-white/[0.04] px-6 py-5">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <span className="h-2 w-2 rounded-full bg-[#14b8a6]" />
                Payment request accepted by PayHarness
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
