import { useState } from 'react';
import Link from 'next/link';

const links = [
  { label: 'Product', href: '#product' },
  { label: 'Developers', href: '#developers' },
  { label: 'Integrations', href: '#integrations' },
  { label: 'Pricing', href: '#pricing' },
];

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-20 w-full max-w-[1400px] items-center px-4 py-3 sm:px-6 sm:py-4 lg:px-10">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center"
          aria-label="PayHarness home"
          onClick={() => setIsMenuOpen(false)}
        >
          <img
            src="https://raw.githubusercontent.com/mojjoiv/harness/feat/payharness-landing-page/logo_transparent.png"
            alt="PayHarness"
            className="block h-9 w-auto object-contain sm:h-11"
          />
          <span className="ml-2 hidden whitespace-nowrap text-lg font-bold tracking-tight text-[#0B1F3A] sm:block sm:text-xl">
            PayHarness
          </span>
        </Link>

        <nav
          className="ml-8 hidden flex-1 items-center gap-7 md:flex lg:ml-14 lg:gap-10"
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

        <div className="ml-auto hidden shrink-0 items-center gap-3 sm:gap-4 md:flex">
          <Link
            href="/login"
            className="px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:text-slate-950"
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

        <div className="relative ml-auto md:hidden">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition hover:bg-slate-50"
            aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
          >
            <span className="sr-only">
              {isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            </span>
            <span className="flex w-5 flex-col gap-1.5" aria-hidden="true">
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
              <span className="h-0.5 w-5 bg-current" />
            </span>
          </button>

          {isMenuOpen && (
            <div
              id="mobile-navigation"
              className="absolute right-0 top-14 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            >
              <nav className="flex flex-col" aria-label="Mobile navigation">
                {links.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setIsMenuOpen(false)}
                    className="rounded-lg px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                  >
                    {link.label}
                  </a>
                ))}
                <div className="my-2 border-t border-slate-100" />
                <Link
                  href="/login"
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-lg px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-950"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setIsMenuOpen(false)}
                  className="mt-2 rounded-lg bg-[#2563eb] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]"
                >
                  Get started
                </Link>
              </nav>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
