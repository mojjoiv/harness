import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DashboardSummary } from '@/lib/types';
import { Badge, Panel, SectionTitle, StatCard } from '@/components/ui';
import { money } from '@/lib/format';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<DashboardSummary>('/dashboard').then(({ data }) => setData(data)).finally(() => setLoading(false));
  }, []);

  const stats = data
    ? [
        { label: 'Today revenue', value: money(data.todayRevenue) },
        { label: 'Today transactions', value: data.todayTransactions },
        { label: 'Successful payments', value: data.successfulPayments },
        { label: 'Failed payments', value: data.failedPayments },
        { label: 'Pending payments', value: data.pendingPayments },
        { label: 'Active API keys', value: data.activeApiKeys },
      ]
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle title="Dashboard" description="Merchant overview and monthly usage." />
      {loading ? <Panel className="p-6 text-sm text-muted">Loading dashboard...</Panel> : null}
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} label={stat.label} value={stat.value} />
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-3">
            <Panel className="p-5 xl:col-span-2">
              <div className="mb-4 text-sm font-medium text-ink">Connected providers</div>
              <div className="flex flex-wrap gap-2">
                {data.connectedProviders.length ? data.connectedProviders.map((provider) => <Badge key={provider}>{provider}</Badge>) : <div className="text-sm text-muted">No providers connected yet.</div>}
              </div>
            </Panel>
            <Panel className="p-5">
              <div className="text-sm text-muted">Subscription plan</div>
              <div className="mt-2 text-2xl font-semibold">{data.subscriptionPlan}</div>
              <div className="mt-4 text-sm text-muted">Monthly usage</div>
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span>Payments</span><span>{data.monthlyUsage.payments}</span></div>
                <div className="flex items-center justify-between"><span>Checkout sessions</span><span>{data.monthlyUsage.checkoutSessions}</span></div>
              </div>
            </Panel>
          </div>
        </>
      ) : null}
    </div>
  );
}
