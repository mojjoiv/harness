import Link from 'next/link';
import { useRouter } from 'next/compat/router';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { getSession } from '@/lib/auth';
import { logout, platformLogout } from './auth';
import { Badge, Button, cx } from './ui';

type NavItem = { label: string; href: string; exact?: boolean; disabled?: boolean };
type NavSection = { title: string; items: NavItem[] };
type MerchantBranding = {
  merchantName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

const sections: NavSection[] = [
  {
    title: 'Main',
    items: [
      { label: 'Dashboard', href: '/dashboard', exact: true },
      { label: 'Transactions', href: '/transactions' },
      { label: 'Checkout Sessions', href: '/checkout-sessions' },
      { label: 'Receipts', href: '/receipts' },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Providers', href: '/providers' },
      { label: 'Analytics', href: '/analytics' },
      { label: 'Payouts', href: '/payouts' },
      { label: 'Reconciliation', href: '/payout-reconciliation' },
    ],
  },
  {
    title: 'Developers',
    items: [
      { label: 'API Keys', href: '/developers/api-keys' },
      { label: 'Webhooks', href: '/developers/webhooks' },
      { label: 'Usage', href: '/developers/usage' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Profile', href: '/settings/profile' },
      { label: 'Team', href: '/settings/team' },
      { label: 'Branding', href: '/settings/branding' },
      { label: 'General', href: '/settings/general' },
    ],
  },
];

function initials(name: string, email: string) {
  const source = name.trim() || email.trim();
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('') || '?'
  );
}

function pageTitle(path: string) {
  const match = sections.flatMap((section) => section.items).find((item) =>
    item.exact ? path === item.href : path.startsWith(item.href),
  );
  return match?.label || 'Dashboard';
}

export function DashboardLayout({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<ReturnType<typeof getSession>>(null);
  const [branding, setBranding] = useState<MerchantBranding | null>(null);
  const currentPath = router?.asPath?.split('?')[0] || '';
  const nav = useMemo(() => sections, []);

  useEffect(() => {
    setSession(getSession());
    void api
      .get<MerchantBranding>('/merchant/branding')
      .then(({ data }) => setBranding(data))
      .catch(() => setBranding(null));
  }, []);

  const workspaceName = branding?.merchantName || 'PayHarness';
  const primaryColor = branding?.primaryColor || '#1d4ed8';

  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="flex min-h-screen">
        <aside
          className={cx(
            'fixed inset-y-0 left-0 z-30 flex w-72 flex-col border-r border-line bg-panel px-4 py-5 shadow-soft transition-transform lg:static lg:translate-x-0 lg:shadow-none',
            open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
          )}
        >
          <div className="mb-6 flex items-center justify-between px-2">
            <Link href="/dashboard" className="group">
              <div className="flex items-center gap-3">
                {branding?.logoUrl ? (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-cover bg-center bg-no-repeat shadow-sm"
                    style={{ backgroundImage: `url(${branding.logoUrl})` }}
                    aria-label={`${workspaceName} logo`}
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: primaryColor }}
                  >
                    P
                  </div>
                )}
                <div>
                  <div className="max-w-40 truncate text-base font-bold tracking-tight">{workspaceName}</div>
                  <div className="text-[11px] text-muted">Merchant workspace</div>
                </div>
              </div>
            </Link>
            <Button variant="ghost" className="lg:hidden" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>

          <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
            {nav.map((section) => (
              <div key={section.title}>
                <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">
                  {section.title}
                </div>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const active = item.exact
                      ? currentPath === item.href
                      : currentPath.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cx(
                          'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                          active
                            ? 'bg-brand text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
                        )}
                      >
                        <span
                          className={cx(
                            'h-1.5 w-1.5 rounded-full',
                            active ? 'bg-white' : 'bg-slate-300',
                          )}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-5 border-t border-line pt-4">
            <div className="flex items-center gap-3 rounded-xl bg-panelAlt p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brandSoft text-xs font-bold text-brand">
                {initials(session?.user.name || '', session?.user.email || '')}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">
                  {session?.user.name || 'Merchant user'}
                </div>
                <div className="truncate text-xs text-muted">
                  {session?.user.email || 'Authenticated workspace'}
                </div>
              </div>
            </div>
            <Button variant="secondary" className="mt-3 w-full" onClick={() => logout(router)}>
              Sign out
            </Button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-line bg-[rgba(246,247,251,0.9)] backdrop-blur">
            <div className="flex min-h-16 items-center justify-between gap-4 px-4 lg:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <Button variant="secondary" className="lg:hidden" onClick={() => setOpen(true)}>
                  Menu
                </Button>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="truncate text-sm font-semibold text-ink">{pageTitle(currentPath)}</h1>
                    {session?.role ? <Badge tone="blue">{session.role}</Badge> : null}
                  </div>
                  <div className="text-xs text-muted">{workspaceName} operational console</div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
      {open ? (
        <button
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}

const platformItems: NavItem[] = [
  { label: 'Dashboard', href: '/platform', exact: true },
  { label: 'Owners', href: '/platform/owners' },
  { label: 'Merchants', href: '/platform/merchants' },
  { label: 'Pending Approvals', href: '/platform/pending' },
  { label: 'Platform Users', href: '/platform/users' },
  { label: 'Subscriptions', href: '/platform/subscriptions' },
  { label: 'Plans', href: '/platform/plans' },
  { label: 'Payment Gateways', href: '/platform/payment-gateways' },
  { label: 'Audit Logs', href: '/platform/audit-logs' },
  { label: 'Settings', href: '/platform/settings' },
  { label: 'Analytics', href: '/platform/analytics', disabled: true },
];

export function PlatformLayout({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const currentPath = router?.asPath?.split('?')[0] || '';

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
              <div className="text-xs text-muted">Platform console</div>
            </div>
            <Button variant="ghost" className="lg:hidden" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
          <nav className="space-y-1">
            {platformItems.map((item) => {
              const active = item.exact
                ? currentPath === item.href
                : currentPath.startsWith(item.href);
              if (item.disabled) {
                return (
                  <div
                    key={item.href}
                    className="flex items-center justify-between rounded-xl px-3 py-2 text-sm text-muted opacity-60"
                  >
                    <span>{item.label}</span>
                    <Badge tone="neutral">Soon</Badge>
                  </div>
                );
              }
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
                  <div className="text-sm font-medium text-ink">Platform</div>
                  <div className="text-xs text-muted">SaaS administration</div>
                </div>
              </div>
              <Button variant="secondary" onClick={() => platformLogout(router)}>
                Logout
              </Button>
            </div>
          </header>
          <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
        </div>
      </div>
      {open ? (
        <button
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
