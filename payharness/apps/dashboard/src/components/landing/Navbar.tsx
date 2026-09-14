import Link from 'next/link';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Developers', href: '#developers' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-[1400px] items-center px-6 py-4 lg:px-10">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-3"
          aria-label="PayHarness home"
        >
          <img
            src="https://raw.githubusercontent.com/mojjoiv/harness/feat/payharness-landing-page/logo_transparent.png"
            alt="PayHarness"
            className="block h-11 w-auto object-contain"
          />
          <span className="text-xl font-bold tracking-tight text-[#0B1F3A]">
            PayHarness
          </span>
        </Link>

        <nav
          className="ml-10 hidden flex-1 items-center gap-8 md:flex lg:ml-14 lg:gap-10"
          aria-label="Main navigation"
        >
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="whitespace-nowrap text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="hidden px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950 sm:block"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#2563eb] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
