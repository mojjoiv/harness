import { useCallback, useEffect, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle, StatCard } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { money } from '@/lib/format';
import { PlatformDashboardOverview } from '@/lib/types';

export default function PlatformDashboardPage() {
  const [data, setData] = useState<PlatformDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlatformDashboardOverview>('/platform/dashboard');
      setData(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load platform metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Dashboard" description="Platform overview for PayHarness operations." />

        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}

        {loading || !data ? (
          <Panel className="p-6 text-sm text-muted">Loading platform metrics…</Panel>
        ) : (
          <>
            <h2 className="mb-2 mt-2 text-sm font-semibold uppercase tracking-wide text-muted">Merchants</h2>
            <div className="grid gap-4 md:grid-cols-5">
              <StatCard label="Total" value={String(data.merchants.total)} subtext="All merchants" />
              <StatCard label="Pending" value={String(data.merchants.pending)} subtext="Awaiting approval" />
              <StatCard label="Active" value={String(data.merchants.active)} subtext="Currently active" />
              <StatCard label="Suspended" value={String(data.merchants.suspended)} subtext="Access paused" />
              <StatCard label="Rejected" value={String(data.merchants.rejected)} subtext="Registration rejected" />
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Team</h2>
            <div className="grid gap-4 md:grid-cols-5">
              <StatCard label="Total Users" value={String(data.users.total)} subtext="Across all merchants" />
              <StatCard label="Owners" value={String(data.users.owners)} subtext="Merchant owners" />
              <StatCard label="Admins" value={String(data.users.admins)} subtext="Admin role" />
              <StatCard label="Developers" value={String(data.users.developers)} subtext="Developer role" />
              <StatCard label="Viewers" value={String(data.users.viewers)} subtext="Read-only role" />
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Platform Health</h2>
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                label="Platform MRR"
                value={money(data.platformMrrCents, 'USD')}
                subtext="Active subscription revenue"
              />
              <StatCard
                label="Total Transactions"
                value={String(data.totalTransactions)}
                subtext="Processed across all merchants"
              />
              <StatCard
                label="API Requests"
                value={String(data.apiRequestsThisMonth)}
                subtext="This month, all merchants"
              />
              <StatCard label="Active Gateways" value={String(data.activeGateways)} subtext="Enabled platform-wide" />
            </div>
          </>
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
