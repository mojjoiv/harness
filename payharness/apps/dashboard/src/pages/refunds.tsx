import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, api } from '@/lib/api';
import { Badge, Button, Input, Panel, SectionTitle, Select, StatCard } from '@/components/ui';
import { FieldRow, FormGrid, Paginator, SimpleTable } from '@/components/blocks';
import { money, dateTime } from '@/lib/format';
import type { PaginationMeta } from '@/lib/types';

type FilterValues = { status: string; provider: string; from: string; to: string };
type RefundRecord = { id: string; paymentId: string; provider: string; amountCents: number; currency: string; status: string; type: string; reference: string | null; createdAt: string };
type RefundDetail = RefundRecord & { metadata: Record<string, unknown> | null; payment: { id: string; provider: string; status: string; amountCents: number; currency: string; providerReference: string | null } | null };
type RefundResponse = { paymentId: string; status: string; provider: string; refundId: string; amountCents: number; refundedAmountCents?: number; remainingAmountCents?: number; currency: string; idempotent: boolean };

function statusTone(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'SUCCEEDED' || normalized === 'REFUNDED') return 'green' as const;
  if (normalized === 'FAILED' || normalized === 'CANCELLED') return 'red' as const;
  if (normalized === 'PENDING' || normalized === 'PROCESSING' || normalized === 'PARTIALLY_REFUNDED') return 'blue' as const;
  return 'neutral' as const;
}

function compactId(value: string) { return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-7)}` : value; }

export default function RefundsPage() {
  const [items, setItems] = useState<RefundRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RefundDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const { register, handleSubmit } = useForm<FilterValues>({ defaultValues: { status: '', provider: '', from: '', to: '' } });
  const [filters, setFilters] = useState<FilterValues>({ status: '', provider: '', from: '', to: '' });

  const load = async (currentPage = page, currentFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(currentPage), limit: '20' });
      if (currentFilters.status) params.set('status', currentFilters.status);
      if (currentFilters.provider) params.set('provider', currentFilters.provider);
      if (currentFilters.from) params.set('from', currentFilters.from);
      if (currentFilters.to) params.set('to', currentFilters.to);
      const response = await api.get<RefundRecord[]>(`/refunds?${params.toString()}`);
      setItems(response.data);
      setMeta(response.meta as PaginationMeta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load refunds.');
    } finally { setLoading(false); }
  };

  const loadDetail = async (id: string) => {
    setSelectedId(id); setDetail(null); setDetailError(''); setDetailLoading(true);
    try {
      const response = await api.get<RefundDetail>(`/refunds/${id}`);
      setDetail(response.data);
    } catch (err) {
      setDetailError(err instanceof ApiError ? err.message : 'Unable to load refund details.');
    } finally { setDetailLoading(false); }
  };

  useEffect(() => { void load(); }, [page]);

  const onSubmit = async (values: FilterValues) => { setFilters(values); setPage(1); await load(1, values); };

  const submitRefund = async () => {
    if (!paymentId.trim()) { setSubmitError('Payment ID is required.'); return; }
    const amountCents = amount.trim() ? Math.round(Number(amount) * 100) : undefined;
    if (amount.trim() && (!Number.isFinite(amountCents) || amountCents <= 0)) { setSubmitError('Refund amount must be a positive amount.'); return; }
    setSubmitting(true); setSubmitError(''); setSubmitMessage('');
    try {
      const response = await api.post<RefundResponse>(`/payments/${encodeURIComponent(paymentId.trim())}/refund`, amountCents === undefined ? {} : { amountCents });
      setSubmitMessage(`${response.data.status.replaceAll('_', ' ')}: ${money(response.data.amountCents, response.data.currency)} refunded.`);
      setPaymentId(''); setAmount(''); await load(1, filters); setPage(1);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Unable to create refund.');
    } finally { setSubmitting(false); }
  };

  const stats = useMemo(() => {
    const succeeded = items.filter((item) => item.status === 'SUCCEEDED').length;
    const totalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
    const providers = new Set(items.map((item) => item.provider)).size;
    return { succeeded, totalCents, providers };
  }, [items]);

  const rows = items.map((refund) => [
    <button key={refund.id} type="button" className="font-medium text-brand hover:underline" onClick={() => void loadDetail(refund.id)}>{compactId(refund.id)}</button>,
    <button key={`${refund.id}-payment`} type="button" className="text-brand hover:underline" onClick={() => setPaymentId(refund.paymentId)}>{compactId(refund.paymentId)}</button>,
    <Badge key={`${refund.id}-provider`} tone="blue">{refund.provider}</Badge>,
    <Badge key={`${refund.id}-status`} tone={statusTone(refund.status)}>{refund.status}</Badge>,
    money(refund.amountCents, refund.currency), refund.reference ? compactId(refund.reference) : '—', dateTime(refund.createdAt),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Refunds" description="Review merchant refunds and issue full or partial refunds for eligible payments." action={<Button variant="secondary" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</Button>} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Refunds" value={stats.succeeded} subtext="On this page" />
        <StatCard label="Refund volume" value={money(stats.totalCents, items[0]?.currency || 'USD')} subtext="On this page" />
        <StatCard label="Providers" value={stats.providers} subtext="Represented on this page" />
      </div>

      <Panel className="p-6">
        <div className="mb-5"><h2 className="text-lg font-semibold text-ink">Issue a refund</h2><p className="mt-1 text-sm text-muted">Leave the amount blank for a full refund. Enter an amount for a partial refund.</p></div>
        <div className="grid gap-4 md:grid-cols-[1fr_220px_auto] md:items-end">
          <FieldRow label="Payment ID"><Input value={paymentId} onChange={(event) => setPaymentId(event.target.value)} placeholder="Payment UUID" /></FieldRow>
          <FieldRow label="Amount (optional)"><Input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Full refund if blank" /></FieldRow>
          <Button type="button" onClick={() => void submitRefund()} disabled={submitting}>{submitting ? 'Processing…' : 'Create refund'}</Button>
        </div>
        {submitMessage ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{submitMessage}</div> : null}
        {submitError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{submitError}</div> : null}
      </Panel>

      <Panel className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormGrid>
            <FieldRow label="Status"><Select {...register('status')}><option value="">All statuses</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option><option value="PENDING">Pending</option></Select></FieldRow>
            <FieldRow label="Provider"><Select {...register('provider')}><option value="">All providers</option><option value="STRIPE">Stripe</option><option value="PAYPAL">PayPal</option><option value="MPESA">M-Pesa</option></Select></FieldRow>
            <FieldRow label="From"><Input type="date" {...register('from')} /></FieldRow>
            <FieldRow label="To"><Input type="date" {...register('to')} /></FieldRow>
          </FormGrid>
          <div className="flex justify-end"><Button type="submit" disabled={loading}>Apply filters</Button></div>
        </form>
      </Panel>

      {error ? <Panel className="border-rose-200 p-6 text-sm text-rose-700">{error}</Panel> : null}
      {loading && !items.length ? <Panel className="p-6 text-sm text-muted">Loading refunds…</Panel> : <SimpleTable headers={['Refund', 'Payment', 'Provider', 'Status', 'Amount', 'Reference', 'Created']} rows={rows} emptyText="No refunds match the selected filters." />}
      <Paginator page={meta.page || page} totalPages={meta.totalPages || 1} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => current + 1)} />

      {selectedId ? <Panel className="p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold text-ink">Refund details</h2><p className="mt-1 text-sm text-muted">{compactId(selectedId)}</p></div><Button variant="ghost" type="button" onClick={() => setSelectedId(null)}>Close</Button></div>
        {detailLoading ? <div className="mt-6 text-sm text-muted">Loading refund details…</div> : null}
        {detailError ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{detailError}</div> : null}
        {detail ? <div className="mt-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><div className="text-xs uppercase tracking-wide text-muted">Amount</div><div className="mt-1 font-semibold">{money(detail.amountCents, detail.currency)}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Provider</div><div className="mt-1"><Badge tone="blue">{detail.provider}</Badge></div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Status</div><div className="mt-1"><Badge tone={statusTone(detail.status)}>{detail.status}</Badge></div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Reference</div><div className="mt-1 break-all font-medium">{detail.reference || '—'}</div></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Panel className="p-4"><div className="text-sm font-medium text-ink">Refund</div><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Refund ID</dt><dd className="max-w-[60%] break-all text-right">{detail.id}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Payment ID</dt><dd className="max-w-[60%] break-all text-right">{detail.paymentId}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Created</dt><dd className="text-right">{dateTime(detail.createdAt)}</dd></div></dl></Panel>
            <Panel className="p-4"><div className="text-sm font-medium text-ink">Original payment</div><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-4"><dt className="text-muted">Status</dt><dd>{detail.payment?.status || '—'}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Amount</dt><dd>{detail.payment ? money(detail.payment.amountCents, detail.payment.currency) : '—'}</dd></div><div className="flex justify-between gap-4"><dt className="text-muted">Provider reference</dt><dd className="max-w-[60%] break-all text-right">{detail.payment?.providerReference || '—'}</dd></div></dl></Panel>
          </div>
        </div> : null}
      </Panel> : null}
    </div>
  );
}
