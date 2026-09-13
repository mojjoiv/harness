import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { PaginationMeta, UsageRecord } from '@/lib/types';
import { Badge, Panel, SectionTitle } from '@/components/ui';
import { Paginator, SimpleTable } from '@/components/blocks';
import { dateTime } from '@/lib/format';

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please check your connection and try again.';
}

function statusTone(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) return 'green' as const;
  if (statusCode >= 400) return 'red' as const;
  return 'neutral' as const;
}

export default function UsagePage() {
  const [items, setItems] = useState<UsageRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, meta: responseMeta } = await api.get<UsageRecord[]>(`/usage?page=${currentPage}&limit=20`);
      setItems(data);
      setMeta(responseMeta);
    } catch (error) {
      setLoadError(formatError(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [load, page]);

  const rows = items.map((record) => [
    record.method,
    record.endpoint,
    <Badge key={`${record.createdAt}-${record.endpoint}`} tone={statusTone(record.statusCode)}>{record.statusCode}</Badge>,
    `${record.responseTimeMs} ms`,
    record.ipAddress || '-',
    dateTime(record.createdAt),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Usage" description="Authenticated API usage tracking." />
      {loading ? <Panel className="p-4 text-sm text-muted" role="status">Loading usage...</Panel> : null}
      {loadError ? <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700" role="alert">{loadError}</Panel> : null}
      <Panel className="p-4 text-sm text-muted">Only authenticated requests are logged. Health checks and docs are skipped.</Panel>
      {!loading && !loadError ? <SimpleTable headers={['Method', 'Endpoint', 'Status', 'Latency', 'IP', 'Created']} rows={rows} emptyText="No usage entries yet." /> : null}
      <Paginator page={meta.page || page} totalPages={meta.totalPages || 1} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => Math.min(meta.totalPages || 1, current + 1))} />
    </div>
  );
}
