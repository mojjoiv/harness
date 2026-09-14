import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle, StatCard } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { money } from '@/lib/format';
import { PlatformDashboardOverview } from '@/lib/types';

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatError(error: unknown) {
  return error instanceof ApiError ? error.message : 'Failed to load platform metrics.';
}

export default function PlatformDashboardPage() {
  const [data, setData] = useState<PlatformDashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const currentRequest = ++requestId.current;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await api.get<PlatformDashboardOverview>('/platform/dashboard');
      if (currentRequest !== requestId.current) return;
      setData(response.data);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(formatError(err));
    } finally {
      if (currentRequest !== requestId.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasData = data !== null;

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <SectionTitle title="Dashboard" description="Platform overview for PayHarness operations." />
          <button
            type="button"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
            className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:bg-panelAlt disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Refresh platform metrics"
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {error ? (
          <div
            className="mb-4 mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        ) : null}

        {loading && !hasData ? (
          <div className="mt-4" role="status" aria-live="polite">
            <Panel className="p-6 text-sm text-muted">Loading platform metrics…</Panel>
          </div>
        ) : !hasData ? (
          <Panel className="mt-4 p-6 text-sm text-muted">
            No platform metrics are available yet. Try refreshing the dashboard.
          </Panel>
        ) : (
          <>
            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Merchants</h2>
            <div className="grid gap-4 md:grid-cols-5">
              <StatCard label="Total" value={formatCount(data.merchants.total)} subtext="All merchants" />
              <StatCard label="Pending" value={formatCount(data.merchants.pending)} subtext="Awaiting approval" />
              <StatCard label="Active" value={formatCount(data.merchants.active)} subtext="Currently active" />
              <StatCard label="Suspended" value={formatCount(data.merchants.suspended)} subtext="Access paused" />
              <StatCard label="Rejected" value={formatCount(data.merchants.rejected)} subtext="Registration rejected" />
            </div>

            <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Team</h2>
            <div className="grid gap-4 md:grid-cols-5">
              <StatCard label="Total Users" value={formatCount(data.users.total)} subtext="Across all merchants" />
              <StatCard label="Owners" value={formatCount(data.users.owners)} subtext="Merchant owners" />
              <StatCard label="Admins" value={formatCount(data.users.admins)} subtext="Admin role" />
              <StatCard label="Developers" value={formatCount(data.users.developers)} subtext="Developer role" />
              <StatCard label="Viewers" value={formatCount(data.users.viewers)} subtext="Read-only role" />
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
                value={formatCount(data.totalTransactions)}
                subtext="Processed across all merchants"
              />
              <StatCard
                label="API Requests"
                value={formatCount(data.apiRequestsThisMonth)}
                subtext="This month, all merchants"
              />
              <StatCard
                label="Active Gateways"
                value={formatCount(data.activeGateways)}
                subtext="Enabled platform-wide"
              />
            </div>
          </>
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
