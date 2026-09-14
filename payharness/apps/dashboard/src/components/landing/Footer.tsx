import Link from 'next/link';

export function Footer() {
  return (
    <footer className="bg-[#07172b] text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 lg:px-8">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex" aria-label="PayHarness home">
              <img
                src="https://raw.githubusercontent.com/mojjoiv/harness/main/logo_transparent.png"
                alt="PayHarness"
                className="h-11 w-auto object-contain"
              />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
              Payment infrastructure for businesses that need reliable payments
              without stitching every provider into their application.
            </p>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Product</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <a href="#product" className="block hover:text-white">Payments</a>
              <a href="#features" className="block hover:text-white">Webhooks</a>
              <a href="#features" className="block hover:text-white">Checkout</a>
              <a href="#features" className="block hover:text-white">Reconciliation</a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Developers</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <Link href="/developers/docs" className="block hover:text-white">Documentation</Link>
              <Link href="/developers/api-keys" className="block hover:text-white">API keys</Link>
              <Link href="/developers/webhooks" className="block hover:text-white">Webhooks</Link>
              <a href="#integrations" className="block hover:text-white">Integrations</a>
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold">Account</h3>
            <div className="mt-4 space-y-3 text-sm text-slate-400">
              <Link href="/login" className="block hover:text-white">Log in</Link>
              <Link href="/register" className="block hover:text-white">Create account</Link>
            </div>
          </div>
        </div>
        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} PayHarness. All rights reserved.</span>
          <span>Payments, built properly.</span>
        </div>
      </div>
    </footer>
  );
}
