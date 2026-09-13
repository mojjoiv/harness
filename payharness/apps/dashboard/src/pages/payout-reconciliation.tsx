import { useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Badge, Button, Panel, SectionTitle, StatCard } from '@/components/ui';
import { Paginator, SimpleTable } from '@/components/blocks';
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
  updatedAt: string;
};

type PayoutList = {
  data: Payout[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

type ReconciliationSummary = {
  scanned: number;
  claimed: number;
  succeeded: number;
  failed: number;
  unresolved: number;
};

function compact(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-7)}` : value;
}

function tone(status: string) {
  if (status === 'SUCCEEDED') return 'green' as const;
  if (status === 'FAILED' || status === 'CANCELED') return 'red' as const;
  if (status === 'PROCESSING' || status === 'PENDING') return 'blue' as const;
  return 'neutral' as const;
}

export default function PayoutReconciliationPage() {
  const [items, setItems] = useState<Payout[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);

  const load = async (nextPage = page) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<PayoutList>(
        `/payouts?status=PROCESSING&page=${nextPage}&pageSize=25`,
      );
      setItems(response.data.data);
      setMeta({ page: response.data.page, totalPages: response.data.totalPages });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load processing payouts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  const runReconciliation = async () => {
    setRunning(true);
    setError('');
    setMessage('');
    try {
      const response = await api.post<ReconciliationSummary>('/payouts/reconciliation/run', {});
      setSummary(response.data);
      setMessage(
        `Reconciliation scanned ${response.data.scanned} stale payout${response.data.scanned === 1 ? '' : 's'}.`,
      );
      await load(page);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to run payout reconciliation.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Payout reconciliation"
        description="Monitor processing payouts and reconcile stale provider states without leaving the merchant workspace."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void load()} disabled={loading || running}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            <Button onClick={() => void runReconciliation()} disabled={running}>
              {running ? 'Reconciling…' : 'Run reconciliation'}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Processing" value={items.length} subtext="Current page" />
        <StatCard label="Scanned" value={summary?.scanned ?? '—'} subtext="Last reconciliation" />
        <StatCard label="Recovered" value={summary?.succeeded ?? '—'} subtext="Marked succeeded" />
        <StatCard label="Unresolved" value={summary?.unresolved ?? '—'} subtext="Still needs provider resolution" />
      </div>

      {message ? (
        <Panel className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</Panel>
      ) : null}
      {error ? <Panel className="border-rose-200 p-4 text-sm text-rose-700">{error}</Panel> : null}

      {summary ? (
        <Panel className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Last reconciliation</h2>
              <p className="mt-1 text-sm text-muted">Results returned by the merchant-scoped reconciliation endpoint.</p>
            </div>
            <Badge tone={summary.unresolved > 0 ? 'blue' : 'green'}>
              {summary.unresolved > 0 ? 'Review unresolved' : 'All resolved'}
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div><div className="text-xs uppercase tracking-wide text-muted">Scanned</div><div className="mt-1 text-xl font-semibold">{summary.scanned}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Claimed</div><div className="mt-1 text-xl font-semibold">{summary.claimed}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Succeeded</div><div className="mt-1 text-xl font-semibold">{summary.succeeded}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Failed</div><div className="mt-1 text-xl font-semibold">{summary.failed}</div></div>
            <div><div className="text-xs uppercase tracking-wide text-muted">Unresolved</div><div className="mt-1 text-xl font-semibold">{summary.unresolved}</div></div>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-6">
        <div className="mb-5">
          <h2 className="text-lg font-semibold">Processing payouts</h2>
          <p className="mt-1 text-sm text-muted">These are the merchant&apos;s payouts currently in PROCESSING. Reconciliation targets stale records according to backend reconciliation policy.</p>
        </div>
        {loading && !items.length ? (
          <div className="text-sm text-muted">Loading processing payouts…</div>
        ) : (
          <SimpleTable
            headers={['Payout', 'Provider', 'Status', 'Recipient', 'Amount', 'Environment', 'Updated']}
            rows={items.map((item) => [
              <span key={item.id} className="font-medium">{compact(item.id)}</span>,
              <Badge key={`${item.id}-provider`} tone="blue">{item.provider}</Badge>,
              <Badge key={`${item.id}-status`} tone={tone(item.status)}>{item.status}</Badge>,
              item.recipientName || item.recipientPhone || item.recipientType,
              money(item.amountCents, item.currency),
              item.environment,
              dateTime(item.updatedAt),
            ])}
            emptyText="No payouts are currently processing."
          />
        )}
        <Paginator
          page={meta.page || page}
          totalPages={meta.totalPages || 1}
          onPrev={() => setPage((value) => Math.max(1, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      </Panel>
    </div>
  );
}
