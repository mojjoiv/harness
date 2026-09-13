import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, api } from '@/lib/api';
import { PaginationMeta, TransactionDetail, TransactionRecord } from '@/lib/types';
import { Badge, Button, Input, Panel, SectionTitle, Select, StatCard } from '@/components/ui';
import { FieldRow, FormGrid, Paginator, SimpleTable } from '@/components/blocks';
import { money, dateTime } from '@/lib/format';

type FilterValues = {
  status: string;
  provider: string;
  from: string;
  to: string;
};

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'SUCCEEDED' || normalized === 'COMPLETED') return 'green' as const;
  if (normalized === 'FAILED' || normalized === 'CANCELLED') return 'red' as const;
  if (normalized === 'PENDING' || normalized === 'PROCESSING') return 'blue' as const;
  return 'neutral' as const;
}

function compactId(value: string) {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

export default function TransactionsPage() {
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [querying, setQuerying] = useState(false);
  const { register, handleSubmit } = useForm<FilterValues>({
    defaultValues: { status: '', provider: '', from: '', to: '' },
  });
  const [filters, setFilters] = useState<FilterValues>({ status: '', provider: '', from: '', to: '' });

  const load = async (currentPage = page, currentFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(currentPage));
      params.set('limit', '20');
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.provider) params.set('provider', currentFilters.provider);
      if (currentFilters.from) params.set('from', currentFilters.from);
      if (currentFilters.to) params.set('to', currentFilters.to);
      const response = await api.get<TransactionRecord[]>(`/transactions?${params.toString()}`);
      setItems(response.data);
      setMeta(response.meta as PaginationMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load transactions.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (paymentId: string) => {
    setSelectedId(paymentId);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      const response = await api.get<TransactionDetail>(`/payments/${paymentId}`);
      setDetail(response.data);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Unable to load payment details.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const onSubmit = async (values: FilterValues) => {
    setFilters(values);
    setPage(1);
    await load(1, values);
  };

  const onQuery = async () => {
    if (!detail) return;
    setQuerying(true);
    setDetailError('');
    try {
      await api.get(`/payments/${detail.paymentId}/query`);
      await loadDetail(detail.paymentId);
      await load(page, filters);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Unable to refresh provider status.');
    } finally {
      setQuerying(false);
    }
  };

  const stats = useMemo(() => {
    const succeeded = items.filter((item) => item.status === 'SUCCEEDED').length;
    const pending = items.filter((item) => item.status === 'PENDING').length;
    const failed = items.filter((item) => ['FAILED', 'CANCELLED'].includes(item.status)).length;
    return { succeeded, pending, failed };
  }, [items]);

  const rows = items.map((tx) => [
    <button
      key={tx.id}
      type="button"
      className="font-medium text-brand hover:underline"
      onClick={() => void loadDetail(tx.id)}
    >
      {compactId(tx.id)}
    </button>,
    <Badge key={`${tx.id}-provider`} tone="blue">{tx.provider}</Badge>,
    <Badge key={`${tx.id}-status`} tone={statusTone(tx.status)}>{tx.status}</Badge>,
    tx.type,
    money(tx.amountCents, tx.currency),
    dateTime(tx.createdAt),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Transactions"
        description="Monitor payment activity and inspect provider-backed transaction details."
        action={
          <Button variant="secondary" type="button" onClick={() => void load()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Successful" value={stats.succeeded} subtext="On this page" />
        <StatCard label="Pending" value={stats.pending} subtext="On this page" />
        <StatCard label="Failed" value={stats.failed} subtext="On this page" />
      </div>

      <Panel className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormGrid>
            <FieldRow label="Status">
              <Select {...register('status')}>
                <option value="">All statuses</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="PENDING">Pending</option>
                <option value="FAILED">Failed</option>
              </Select>
            </FieldRow>
            <FieldRow label="Provider">
              <Select {...register('provider')}>
                <option value="">All providers</option>
                <option value="MPESA">M-Pesa</option>
                <option value="STRIPE">Stripe</option>
                <option value="PAYPAL">PayPal</option>
              </Select>
            </FieldRow>
            <FieldRow label="From"><Input type="date" {...register('from')} /></FieldRow>
            <FieldRow label="To"><Input type="date" {...register('to')} /></FieldRow>
          </FormGrid>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>Apply filters</Button>
          </div>
        </form>
      </Panel>

      {error ? <Panel className="border-rose-200 p-6 text-sm text-rose-700">{error}</Panel> : null}
      {loading && !items.length ? (
        <Panel className="p-6 text-sm text-muted">Loading transactions…</Panel>
      ) : (
        <SimpleTable
          headers={['Payment', 'Provider', 'Status', 'Type', 'Amount', 'Created']}
          rows={rows}
          emptyText="No transactions match the selected filters."
        />
      )}

      <Paginator
        page={meta.page || page}
        totalPages={meta.totalPages || 1}
        onPrev={() => setPage((current) => Math.max(1, current - 1))}
        onNext={() => setPage((current) => current + 1)}
      />

      {selectedId ? (
        <Panel className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-ink">Payment details</h2>
              <p className="mt-1 text-sm text-muted">{compactId(selectedId)}</p>
            </div>
            <Button variant="ghost" type="button" onClick={() => setSelectedId(null)}>Close</Button>
          </div>

          {detailLoading ? <div className="mt-6 text-sm text-muted">Loading payment details…</div> : null}
          {detailError ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{detailError}</div> : null}

          {detail ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div><div className="text-xs uppercase tracking-wide text-muted">Amount</div><div className="mt-1 font-semibold">{money(detail.amountCents, detail.currency)}</div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted">Provider</div><div className="mt-1"><Badge tone="blue">{detail.provider}</Badge></div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted">Status</div><div className="mt-1"><Badge tone={statusTone(detail.status)}>{detail.status}</Badge></div></div>
                <div><div className="text-xs uppercase tracking-wide text-muted">Environment</div><div className="mt-1 font-medium">{detail.environment}</div></div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Panel className="p-4">
                  <div className="text-sm font-medium text-ink">Payment references</div>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex justify-between gap-4"><dt className="text-muted">Payment ID</dt><dd className="max-w-[60%] break-all text-right">{detail.paymentId}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Provider reference</dt><dd className="max-w-[60%] break-all text-right">{detail.providerReference || '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Customer</dt><dd className="max-w-[60%] break-all text-right">{detail.customerId || '—'}</dd></div>
                    <div className="flex justify-between gap-4"><dt className="text-muted">Checkout session</dt><dd className="max-w-[60%] break-all text-right">{detail.checkoutSessionId || '—'}</dd></div>
                  </dl>
                </Panel>
                <Panel className="p-4">
                  <div className="text-sm font-medium text-ink">Provider status</div>
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <div className="text-sm text-muted">{detail.providerStatus || detail.status}</div>
                    {detail.status === 'PENDING' ? (
                      <Button type="button" variant="secondary" onClick={() => void onQuery()} disabled={querying}>
                        {querying ? 'Checking…' : 'Check provider'}
                      </Button>
                    ) : null}
                  </div>
                </Panel>
              </div>

              <div>
                <div className="mb-3 text-sm font-medium text-ink">Transaction history</div>
                <SimpleTable
                  headers={['Type', 'Status', 'Amount', 'Reference', 'Created']}
                  rows={detail.transactions.map((transaction) => [
                    transaction.type,
                    <Badge key={`${transaction.id}-status`} tone={statusTone(transaction.status)}>{transaction.status}</Badge>,
                    money(transaction.amountCents, transaction.currency),
                    transaction.reference ? compactId(transaction.reference) : '—',
                    dateTime(transaction.createdAt),
                  ])}
                  emptyText="No transaction events recorded."
                />
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
    </div>
  );
}
