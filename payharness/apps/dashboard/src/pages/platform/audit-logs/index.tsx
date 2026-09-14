import { useCallback, useEffect, useRef, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Paginator, SimpleTable } from '@/components/blocks';
import { Button, Panel, SectionTitle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PaginationMeta, PlatformAuditLogRecord } from '@/lib/types';

const PAGE_SIZE = 20;

export default function PlatformAuditLogsPage() {
  const [items, setItems] = useState<PlatformAuditLogRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async (currentPage: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    try {
      const { data, meta } = await api.get<PlatformAuditLogRecord[]>(
        `/platform/audit-logs?page=${currentPage}&limit=${PAGE_SIZE}`,
      );
      if (id !== requestId.current) return;
      setItems(data);
      setMeta(meta);
      setExpanded(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs.');
    } finally {
      if (id === requestId.current) setLoading(false);
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
    <div key="metadata">
      <button
        type="button"
        className="text-sm text-brand underline"
        aria-expanded={expanded === log.id}
        aria-controls={`audit-metadata-${log.id}`}
        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
      >
        {expanded === log.id ? 'Hide' : 'View'}
      </button>
      {expanded === log.id ? (
        <pre
          id={`audit-metadata-${log.id}`}
          className="mt-2 max-w-md overflow-auto rounded-lg bg-panelAlt p-2 text-left text-xs text-ink"
        >
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      ) : null}
    </div>,
  ]);

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle
          title="Audit Logs"
          description="Every critical action taken across the platform."
          action={
            <Button variant="secondary" disabled={loading} onClick={() => load(page)}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        {error ? (
          <Panel
            className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
            role="alert"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{error}</span>
              <Button variant="secondary" disabled={loading} onClick={() => load(page)}>
                Retry
              </Button>
            </div>
          </Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted" role="status">
            Loading audit logs…
          </Panel>
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
              onNext={() => setPage((p) => Math.min(meta.totalPages || 1, p + 1))}
            />
          </>
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
