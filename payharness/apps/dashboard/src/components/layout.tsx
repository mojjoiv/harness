import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { logout } from './auth';
import { Button, cx } from './ui';

type NavItem = { label: string; href: string; exact?: boolean };
type NavSection = { title: string; items: NavItem[] };

const sections: NavSection[] = [
  { title: 'Main', items: [{ label: 'Dashboard', href: '/dashboard', exact: true }, { label: 'Transactions', href: '/transactions' }, { label: 'Checkout Sessions', href: '/checkout-sessions' }] },
  { title: 'Operations', items: [{ label: 'Providers', href: '/providers' }, { label: 'Analytics', href: '/analytics' }] },
  { title: 'Developers', items: [{ label: 'API Keys', href: '/developers/api-keys' }, { label: 'Webhooks', href: '/developers/webhooks' }, { label: 'Usage', href: '/developers/usage' }] },
  { title: 'Settings', items: [{ label: 'Profile', href: '/settings/profile' }, { label: 'Branding', href: '/settings/branding' }, { label: 'General', href: '/settings/general' }] },
];

export function DashboardLayout({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const currentPath = router.asPath.split('?')[0];

  const nav = useMemo(() => sections, []);

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen">
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-30 w-72 border-r border-line bg-panel px-4 py-5 shadow-soft transition-transform lg:static lg:translate-x-0 lg:shadow-none',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="mb-6 flex items-center justify-between">
            <div>
              <div className="text-lg font-semibold">PayHarness</div>
              <div className="text-xs text-muted">Merchant dashboard</div>
            </div>
            <Button variant="ghost" className="lg:hidden" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <nav className="space-y-5">
            {nav.map((section) => (
              <div key={section.title}>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{section.title}</div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = item.exact ? currentPath === item.href : currentPath.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cx(
                          'block rounded-xl px-3 py-2 text-sm transition',
                          active ? 'bg-brand text-white' : 'text-ink hover:bg-slate-100',
                        )}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-[rgba(246,247,251,0.9)] backdrop-blur">
            <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
                  Menu
                </Button>
                <div>
                  <div className="text-sm font-medium text-ink">PayHarness</div>
                  <div className="text-xs text-muted">Operational console</div>
                </div>
              </div>
              <Button variant="secondary" onClick={() => logout(router)}>
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
      {open ? <button className="fixed inset-0 z-20 bg-black/30 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
    </div>
  );
}
