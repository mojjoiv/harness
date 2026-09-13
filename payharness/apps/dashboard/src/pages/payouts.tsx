import { useEffect, useMemo, useState } from 'react';
import { ApiError, api, apiRequest } from '@/lib/api';
import { Badge, Button, Input, Panel, SectionTitle, Select, StatCard } from '@/components/ui';
import { FieldRow, FormGrid, Paginator, SimpleTable } from '@/components/blocks';
import { dateTime, money } from '@/lib/format';

type Payout = {
  id: string;
  amountCents: number;
  currency: string;
  provider: string;
  environment: string;
  status: string;
  recipientType: string;
  recipientPhone: string | null;
  recipientName: string | null;
  providerReference: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

type PayoutList = { data: Payout[]; total: number; page: number; pageSize: number; totalPages: number };
type Report = { totalCount: number; totalVolumeCents: number; successfulCount: number; successfulVolumeCents: number; failedCount: number; failedVolumeCents: number; pendingCount: number; pendingVolumeCents: number; successRate: number };
type Filters = { status: string; provider: string; environment: string; currency: string; search: string; startDate: string; endDate: string };

function tone(status: string) {
  if (status === 'SUCCEEDED') return 'green' as const;
  if (status === 'FAILED' || status === 'CANCELED') return 'red' as const;
  if (status === 'PENDING' || status === 'PROCESSING') return 'blue' as const;
  return 'neutral' as const;
}

function compact(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-7)}` : value;
}

export default function PayoutsPage() {
  const [items, setItems] = useState<Payout[]>([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 25, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({ status: '', provider: '', environment: '', currency: '', search: '', startDate: '', endDate: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Payout | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [form, setForm] = useState({ amount: '', currency: 'KES', provider: 'MPESA', environment: 'LIVE', recipientType: 'PHONE', recipientPhone: '', recipientName: '' });

  const load = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), pageSize: '25' });
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value) params.set(key, value);
      });
      const response = await api.get<PayoutList>(`/payouts?${params.toString()}`);
      setItems(response.data.data);
      setMeta(response.data);
      const reportParams = new URLSearchParams();
      if (nextFilters.startDate) reportParams.set('startDate', nextFilters.startDate);
      if (nextFilters.endDate) reportParams.set('endDate', nextFilters.endDate);
      const reportResponse = await api.get<Report>(`/payouts/report?${reportParams.toString()}`);
      setReport(reportResponse.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load payouts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const selectPayout = async (id: string) => {
    setDetailLoading(true);
    setActionError('');
    try {
      const response = await api.get<Payout>(`/payouts/${id}`);
      setSelected(response.data);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to load payout details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const createPayout = async () => {
    const amountCents = Math.round(Number(form.amount) * 100);
    if (!Number.isFinite(amountCents) || amountCents < 1 || !form.currency || !form.recipientType) {
      setActionError('Enter a valid amount, currency, and recipient type.');
      return;
    }
    if (form.provider === 'MPESA' && !form.recipientPhone.trim()) {
      setActionError('M-Pesa payouts require a recipient phone number.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    setActionMessage('');
    try {
      const key = `dashboard-payout-${crypto.randomUUID()}`;
      const response = await apiRequest<Payout>('/payouts', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          amountCents,
          currency: form.currency,
          provider: form.provider,
          environment: form.environment,
          recipientType: form.recipientType,
          recipientPhone: form.recipientPhone || undefined,
          recipientName: form.recipientName || undefined,
        }),
      });
      setActionMessage(`Payout ${compact(response.data.id)} created with status ${response.data.status}.`);
      setForm({ ...form, amount: '', recipientPhone: '', recipientName: '' });
      await load(1, filters);
      setPage(1);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to create payout.');
    } finally {
      setActionLoading(false);
    }
  };

  const execute = async () => {
    if (!selected) return;
    setActionLoading(true);
    setActionError('');
    setActionMessage('');
    try {
      const response = await api.post<Payout>(`/payouts/${selected.id}/execute`, {});
      setSelected(response.data);
      setActionMessage(`Payout is now ${response.data.status}.`);
      await load(page, filters);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Unable to execute payout.');
    } finally {
      setActionLoading(false);
    }
  };

  const stats = useMemo(
    () =>
      report || {
        totalCount: 0,
        totalVolumeCents: 0,
        successfulCount: 0,
        successfulVolumeCents: 0,
        failedCount: 0,
        failedVolumeCents: 0,
        pendingCount: 0,
        pendingVolumeCents: 0,
        successRate: 0,
      },
    [report],
  );

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Payouts"
        description="Create, monitor, and execute merchant payouts across configured providers."
        action={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Total payouts" value={stats.totalCount} subtext="Selected period" />
        <StatCard label="Total volume" value={money(stats.totalVolumeCents, filters.currency || 'KES')} subtext="Selected period" />
        <StatCard label="Successful" value={stats.successfulCount} subtext={`${stats.successRate}% success rate`} />
        <StatCard label="Pending" value={stats.pendingCount} subtext={money(stats.pendingVolumeCents, filters.currency || 'KES')} />
      </div>

      <Panel className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Create payout</h2>
          <p className="mt-1 text-sm text-muted">An idempotency key is generated for each dashboard submission.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <FieldRow label="Amount"><Input type="number" min="0.01" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="1000.00" /></FieldRow>
          <FieldRow label="Currency"><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></FieldRow>
          <FieldRow label="Provider"><Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}><option value="MPESA">M-Pesa</option><option value="PAYPAL">PayPal</option><option value="STRIPE">Stripe</option></Select></FieldRow>
          <FieldRow label="Environment"><Select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value })}><option value="LIVE">Live</option><option value="TEST">Test</option></Select></FieldRow>
          <FieldRow label="Recipient type"><Select value={form.recipientType} onChange={(e) => setForm({ ...form, recipientType: e.target.value })}><option value="PHONE">Phone</option><option value="EMAIL">Email</option><option value="PAYPAL_ID">PayPal ID</option></Select></FieldRow>
          <FieldRow label="Recipient phone"><Input value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} placeholder="2547…" /></FieldRow>
          <FieldRow label="Recipient name"><Input value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} /></FieldRow>
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={() => void createPayout()} disabled={actionLoading}>{actionLoading ? 'Processing…' : 'Create payout'}</Button></div>
        {actionMessage ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{actionMessage}</div> : null}
        {actionError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError}</div> : null}
      </Panel>

      <Panel className="p-6">
        <div className="space-y-4">
          <FormGrid>
            <FieldRow label="Status"><Select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="PROCESSING">Processing</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option><option value="CANCELED">Canceled</option></Select></FieldRow>
            <FieldRow label="Provider"><Select value={filters.provider} onChange={(e) => setFilters({ ...filters, provider: e.target.value })}><option value="">All providers</option><option value="MPESA">M-Pesa</option><option value="PAYPAL">PayPal</option><option value="STRIPE">Stripe</option></Select></FieldRow>
            <FieldRow label="Environment"><Select value={filters.environment} onChange={(e) => setFilters({ ...filters, environment: e.target.value })}><option value="">All environments</option><option value="LIVE">Live</option><option value="TEST">Test</option></Select></FieldRow>
            <FieldRow label="Currency"><Input value={filters.currency} onChange={(e) => setFilters({ ...filters, currency: e.target.value.toUpperCase() })} placeholder="KES" /></FieldRow>
            <FieldRow label="Search"><Input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Payout ID or reference" /></FieldRow>
            <FieldRow label="Start date"><Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} /></FieldRow>
            <FieldRow label="End date"><Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} /></FieldRow>
          </FormGrid>
          <div className="flex justify-end"><Button onClick={() => { setPage(1); void load(1, filters); }}>Apply filters</Button></div>
        </div>
      </Panel>

      {error ? <Panel className="border-rose-200 p-6 text-sm text-rose-700">{error}</Panel> : null}
      {loading && !items.length ? <Panel className="p-6 text-sm text-muted">Loading payouts…</Panel> : <SimpleTable headers={['Payout', 'Provider', 'Status', 'Recipient', 'Amount', 'Environment', 'Created']} rows={items.map((item) => [<button key={item.id} type="button" className="font-medium text-brand hover:underline" onClick={() => void selectPayout(item.id)}>{compact(item.id)}</button>, <Badge key={`${item.id}-provider`} tone="blue">{item.provider}</Badge>, <Badge key={`${item.id}-status`} tone={tone(item.status)}>{item.status}</Badge>, item.recipientName || item.recipientPhone || item.recipientType, money(item.amountCents, item.currency), item.environment, dateTime(item.createdAt)])} emptyText="No payouts match the selected filters." />}
      <Paginator page={meta.page || page} totalPages={meta.totalPages || 1} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />

      {selected ? <Panel className="p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Payout details</h2><p className="mt-1 text-sm text-muted">{compact(selected.id)}</p></div><Button variant="ghost" onClick={() => setSelected(null)}>Close</Button></div>
        {detailLoading ? <div className="mt-5 text-sm text-muted">Loading…</div> : null}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><div className="text-xs uppercase tracking-wide text-muted">Amount</div><div className="mt-1 font-semibold">{money(selected.amountCents, selected.currency)}</div></div><div><div className="text-xs uppercase tracking-wide text-muted">Provider</div><div className="mt-1"><Badge tone="blue">{selected.provider}</Badge></div></div><div><div className="text-xs uppercase tracking-wide text-muted">Status</div><div className="mt-1"><Badge tone={tone(selected.status)}>{selected.status}</Badge></div></div><div><div className="text-xs uppercase tracking-wide text-muted">Reference</div><div className="mt-1 break-all">{selected.providerReference || '—'}</div></div></div>
        <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2"><div className="flex justify-between gap-4"><dt className="text-muted">Recipient</dt><dd>{selected.recipientName || selected.recipientPhone || selected.recipientType}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Created</dt><dd>{dateTime(selected.createdAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Updated</dt><dd>{dateTime(selected.updatedAt)}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Failure reason</dt><dd>{selected.failureReason || '—'}</dd></div></dl>
        {selected.status === 'PENDING' ? <div className="mt-6 flex justify-end"><Button onClick={() => void execute()} disabled={actionLoading}>{actionLoading ? 'Executing…' : 'Execute payout'}</Button></div> : null}
      </Panel> : null}
    </div>
  );
}
