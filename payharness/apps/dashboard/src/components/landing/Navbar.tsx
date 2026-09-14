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
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center" aria-label="PayHarness home">
          <img
            src="https://raw.githubusercontent.com/mojjoiv/harness/main/logo_transparent.png"
            alt="PayHarness"
            className="h-10 w-auto object-contain"
          />
        </Link>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden px-3 py-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950 sm:block"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
