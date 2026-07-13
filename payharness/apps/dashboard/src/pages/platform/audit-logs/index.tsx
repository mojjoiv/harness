import { useCallback, useEffect, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Paginator, SimpleTable } from '@/components/blocks';
import { Panel, SectionTitle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PaginationMeta, PlatformAuditLogRecord } from '@/lib/types';

export default function PlatformAuditLogsPage() {
  const [items, setItems] = useState<PlatformAuditLogRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      const { data, meta } = await api.get<PlatformAuditLogRecord[]>(
        `/platform/audit-logs?page=${currentPage}&limit=20`,
      );
      setItems(data);
      setMeta(meta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(page);
  }, [load, page]);

  const rows = items.map((log) => [
    log.user ? `${log.user.name} (${log.user.email})` : 'Platform',
    log.entity,
    log.merchant?.name || '—',
    log.action,
    dateTime(log.createdAt),
    <button
      key="metadata"
      type="button"
      className="text-sm text-brand underline"
      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
    >
      {expanded === log.id ? 'Hide' : 'View'}
      {expanded === log.id ? (
        <pre className="mt-2 max-w-md overflow-auto rounded-lg bg-panelAlt p-2 text-left text-xs text-ink">
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      ) : null}
    </button>,
  ]);

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Audit Logs" description="Every critical action taken across the platform." />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading audit logs…</Panel>
        ) : (
          <>
            <SimpleTable
              headers={['User', 'Entity', 'Merchant', 'Action', 'Timestamp', 'Metadata']}
              rows={rows}
              emptyText="No audit log entries yet."
            />
            <Paginator
              page={meta.page || page}
              totalPages={meta.totalPages || 1}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => p + 1)}
            />
          </>
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
