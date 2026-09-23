export function Hero() {
  return (
    <section className="overflow-hidden bg-white">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 pb-20 pt-16 lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-24">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-2 text-xs font-semibold text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Payment infrastructure for growing businesses
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.045em] text-[#0b1f3a] sm:text-6xl lg:text-[4.4rem]">
            Payments that work with your business, not against it.
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
            Give your customers more ways to pay without building your entire payment stack around every provider. PayHarness gives you one integration for payments, checkout, webhooks and transaction management.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a href="/register" className="rounded-lg bg-[#2563eb] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#1d4ed8]">
              Start accepting payments
            </a>
            <a href="/developers" className="rounded-lg border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950">
              Explore the developer portal
            </a>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
            <span>One integration</span><span>•</span><span>Stripe</span><span>•</span><span>PayPal</span><span>•</span><span>Built to expand</span>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.16),transparent_65%)]" />
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(11,31,58,0.14)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div><div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Payment received</div><div className="mt-1 text-sm font-semibold text-[#0b1f3a]">Order #ORD-1042</div></div>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Succeeded</span>
            </div>
            <div className="p-6">
              <div className="text-4xl font-semibold tracking-tight text-[#0b1f3a]">KES 25,000.00</div>
              <div className="mt-2 text-sm text-slate-500">Customer payment processed through PayHarness</div>
              <div className="mt-7 rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm"><span className="text-slate-500">Provider</span><span className="font-semibold text-slate-900">Stripe</span></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">Payment ID</span><span className="font-mono text-xs text-slate-700">pay_8f31...</span></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">Webhook</span><span className="font-semibold text-emerald-700">Delivered</span></div>
              </div>
              <div className="mt-6 grid grid-cols-3 gap-2">
                {['Stripe', 'PayPal', 'More providers'].map((provider, index) => (
                  <div key={provider} className="rounded-xl border border-slate-200 px-3 py-3 text-center text-xs font-semibold text-slate-600">
                    <div className={`mx-auto mb-2 h-2 w-2 rounded-full ${index === 0 ? 'bg-blue-500' : 'bg-slate-300'}`} />
                    {provider}
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs text-slate-500">Your app → PayHarness → payment provider → your order state</div>
          </div>
        </div>
      </div>
    </section>
  );
}
