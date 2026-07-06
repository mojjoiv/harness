import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Panel, SectionTitle, StatCard } from '@/components/ui';
import { SimpleTable } from '@/components/blocks';

type Row = { date?: string; provider?: string; status?: string; count: number; amountCents: number };

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<Row[]>([]);
  const [providers, setProviders] = useState<Row[]>([]);
  const [payments, setPayments] = useState<Row[]>([]);

  useEffect(() => {
    api.get<Row[]>('/analytics/revenue?period=monthly').then(({ data }) => setRevenue(data));
    api.get<Row[]>('/analytics/providers?period=monthly').then(({ data }) => setProviders(data));
    api.get<Row[]>('/analytics/payments?period=monthly').then(({ data }) => setPayments(data));
  }, []);

  return (
    <div className="space-y-6">
      <SectionTitle title="Analytics" description="Simple summary tables for revenue, providers, and payments." />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Revenue points" value={revenue.length} />
        <StatCard label="Provider groups" value={providers.length} />
        <StatCard label="Payment groups" value={payments.length} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="p-4 xl:col-span-1">
          <div className="mb-3 text-sm font-medium">Revenue</div>
          <SimpleTable
            headers={['Date', 'Amount']}
            rows={revenue.map((row) => [row.date || '-', row.amountCents])}
            emptyText="No revenue data yet."
          />
        </Panel>
        <Panel className="p-4 xl:col-span-1">
          <div className="mb-3 text-sm font-medium">Providers</div>
          <SimpleTable
            headers={['Provider', 'Count', 'Amount']}
            rows={providers.map((row) => [row.provider || '-', row.count, row.amountCents])}
            emptyText="No provider data yet."
          />
        </Panel>
        <Panel className="p-4 xl:col-span-1">
          <div className="mb-3 text-sm font-medium">Payments</div>
          <SimpleTable
            headers={['Status', 'Count', 'Amount']}
            rows={payments.map((row) => [row.status || '-', row.count, row.amountCents])}
            emptyText="No payment data yet."
          />
        </Panel>
      </div>
    </div>
  );
}
