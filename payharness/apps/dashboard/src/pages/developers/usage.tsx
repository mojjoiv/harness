import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PaginationMeta, UsageRecord } from '@/lib/types';
import { Panel, SectionTitle } from '@/components/ui';
import { Paginator, SimpleTable } from '@/components/blocks';
import { dateTime } from '@/lib/format';

export default function UsagePage() {
  const [items, setItems] = useState<UsageRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);

  const load = async (currentPage = page) => {
    const { data, meta } = await api.get<UsageRecord[]>(`/usage?page=${currentPage}&limit=20`);
    setItems(data);
    setMeta(meta);
  };

  useEffect(() => {
    load();
  }, [page]);

  const rows = items.map((record) => [
    record.method,
    record.endpoint,
    record.statusCode,
    `${record.responseTimeMs} ms`,
    record.ipAddress || '-',
    dateTime(record.createdAt),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Usage" description="Authenticated API usage tracking." />
      <Panel className="p-4 text-sm text-muted">
        Only authenticated requests are logged. Health checks and docs are skipped.
      </Panel>
      <SimpleTable headers={['Method', 'Endpoint', 'Status', 'Latency', 'IP', 'Created']} rows={rows} emptyText="No usage entries yet." />
      <Paginator page={meta.page || page} totalPages={meta.totalPages || 1} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}
