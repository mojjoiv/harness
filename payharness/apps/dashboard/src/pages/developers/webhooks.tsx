import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { Badge, Button, CopyButton, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, FormGrid, Paginator, SimpleTable } from '@/components/blocks';
import { PaginationMeta, WebhookEndpointRecord } from '@/lib/types';
import { dateTime } from '@/lib/format';

type Delivery = {
  id: string;
  webhookEndpointId: string | null;
  eventType: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  responseBody: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

type DeliveryDetail = Delivery & { payload: unknown };
type FormValues = { url: string; events: string };
type EndpointAction = 'test' | 'rotate' | 'disable';

function tone(status: string) {
  if (status === 'SUCCEEDED' || status === 'ACTIVE') return 'green' as const;
  if (status === 'FAILED' || status === 'INACTIVE') return 'red' as const;
  if (status === 'PENDING' || status === 'PROCESSING') return 'blue' as const;
  return 'neutral' as const;
}

function compact(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-7)}` : value;
}

function formatError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export default function WebhooksPage() {
  const [items, setItems] = useState<WebhookEndpointRecord[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [secret, setSecret] = useState('');
  const [endpointMeta, setEndpointMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [deliveryMeta, setDeliveryMeta] = useState<PaginationMeta>({ page: 1, limit: 25, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [error, setError] = useState('');
  const [deliveryError, setDeliveryError] = useState('');
  const [actionError, setActionError] = useState('');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<DeliveryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionId, setActionId] = useState('');
  const [actionType, setActionType] = useState<EndpointAction | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [eventFilter, setEventFilter] = useState('');
  const [form, setForm] = useState<FormValues>({ url: '', events: 'payment.succeeded, payment.failed, payment.refunded' });

  const loadEndpoints = useCallback(async (currentPage: number) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get<WebhookEndpointRecord[]>(`/webhooks/endpoints?page=${currentPage}&limit=20`);
      setItems(response.data);
      setEndpointMeta(response.meta as PaginationMeta);
    } catch (err) {
      setError(formatError(err, 'Unable to load webhook endpoints.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDeliveries = useCallback(async (currentPage: number) => {
    setDeliveryLoading(true);
    setDeliveryError('');
    try {
      const response = await api.get<Delivery[]>(`/webhooks/deliveries?page=${currentPage}&limit=25`);
      setDeliveries(response.data);
      setDeliveryMeta(response.meta as PaginationMeta);
    } catch (err) {
      setDeliveryError(formatError(err, 'Unable to load webhook deliveries.'));
    } finally {
      setDeliveryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEndpoints(page);
  }, [loadEndpoints, page]);

  useEffect(() => {
    void loadDeliveries(deliveryPage);
  }, [deliveryPage, loadDeliveries]);

  const filteredDeliveries = useMemo(
    () => deliveries.filter((delivery) => {
      const statusMatch = !statusFilter || delivery.status === statusFilter;
      const eventMatch = !eventFilter || delivery.eventType.toLowerCase().includes(eventFilter.trim().toLowerCase());
      return statusMatch && eventMatch;
    }),
    [deliveries, eventFilter, statusFilter],
  );

  const beginAction = (id: string, type: EndpointAction) => {
    setActionLoading(true);
    setActionId(id);
    setActionType(type);
    setActionError('');
    setMessage('');
  };

  const endAction = () => {
    setActionLoading(false);
    setActionId('');
    setActionType('');
  };

  const create = async () => {
    const url = form.url.trim();
    const events = form.events.split(',').map((event) => event.trim()).filter(Boolean);

    if (!url || !isValidUrl(url) || !events.length) {
      setActionError('Enter a valid HTTP(S) endpoint URL and at least one event.');
      return;
    }

    beginAction('create', 'test');
    try {
      const response = await api.post<WebhookEndpointRecord>('/webhooks/endpoints', { url, events });
      setSecret(response.data.secret || '');
      setMessage('Endpoint created. Save the secret below; it will not be returned by listing APIs.');
      setForm({ url: '', events: form.events });
      setPage(1);
      await loadEndpoints(1);
    } catch (err) {
      setActionError(formatError(err, 'Unable to create webhook endpoint.'));
    } finally {
      endAction();
    }
  };

  const rotateSecret = async (id: string) => {
    if (!window.confirm('Rotate this webhook secret? The current secret will stop working.')) return;
    beginAction(id, 'rotate');
    try {
      const response = await api.post<WebhookEndpointRecord>(`/webhooks/endpoints/${id}/rotate-secret`, {});
      setSecret(response.data.secret || '');
      setMessage('Webhook secret rotated. Save the new secret below.');
    } catch (err) {
      setActionError(formatError(err, 'Unable to rotate webhook secret.'));
    } finally {
      endAction();
    }
  };

  const disable = async (id: string) => {
    if (!window.confirm('Disable this webhook endpoint?')) return;
    beginAction(id, 'disable');
    try {
      await api.patch(`/webhooks/endpoints/${id}/disable`, {});
      setMessage('Webhook endpoint disabled.');
      await loadEndpoints(page);
    } catch (err) {
      setActionError(formatError(err, 'Unable to disable webhook endpoint.'));
    } finally {
      endAction();
    }
  };

  const test = async (id: string) => {
    beginAction(id, 'test');
    try {
      const response = await api.post<{ delivered: boolean; attempts: number }>(`/webhooks/endpoints/${id}/test`, {});
      setMessage(`Test delivery ${response.data.delivered ? 'succeeded' : 'failed'} after ${response.data.attempts} attempt(s).`);
      setDeliveryPage(1);
      await loadDeliveries(1);
    } catch (err) {
      setActionError(formatError(err, 'Unable to test webhook endpoint.'));
    } finally {
      endAction();
    }
  };

  const selectDelivery = async (id: string) => {
    setDetailLoading(true);
    setActionError('');
    try {
      const response = await api.get<DeliveryDetail>(`/webhooks/deliveries/${id}`);
      setSelected(response.data);
    } catch (err) {
      setActionError(formatError(err, 'Unable to load delivery details.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const retryDelivery = async () => {
    if (!selected) return;
    beginAction(selected.id, 'test');
    try {
      const response = await api.post<{ delivered: boolean; attempts: number }>(`/webhooks/deliveries/${selected.id}/retry`, {});
      setMessage(`Delivery retry ${response.data.delivered ? 'succeeded' : 'failed'} after ${response.data.attempts} attempt(s).`);
      await selectDelivery(selected.id);
      await loadDeliveries(deliveryPage);
    } catch (err) {
      setActionError(formatError(err, 'Unable to retry webhook delivery.'));
    } finally {
      endAction();
    }
  };

  const endpointBusy = (id: string) => actionLoading && actionId === id;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Webhooks"
        description="Configure merchant endpoints and inspect webhook delivery reliability."
        action={<Button variant="secondary" onClick={() => { void loadEndpoints(page); void loadDeliveries(deliveryPage); }} disabled={loading || deliveryLoading}>{loading || deliveryLoading ? 'Refreshing…' : 'Refresh'}</Button>}
      />

      {message ? <Panel className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{message}</Panel> : null}
      {actionError ? <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{actionError}</Panel> : null}

      {secret ? (
        <Panel className="p-4">
          <div className="text-sm text-muted">Webhook secret — save it now. It is only returned on create or rotation.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-xl bg-panelAlt px-3 py-2 text-sm">{secret}</code><CopyButton value={secret} /></div>
        </Panel>
      ) : null}

      <Panel className="p-6">
        <div className="mb-5"><h2 className="text-lg font-semibold">Add endpoint</h2><p className="mt-1 text-sm text-muted">Use comma-separated event names such as payment.succeeded and payment.failed.</p></div>
        <FormGrid>
          <FieldRow label="Endpoint URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhooks" disabled={actionLoading} /></FieldRow>
          <FieldRow label="Events"><Input value={form.events} onChange={(e) => setForm({ ...form, events: e.target.value })} disabled={actionLoading} /></FieldRow>
        </FormGrid>
        <div className="mt-4 flex justify-end"><Button onClick={() => void create()} disabled={actionLoading}>{actionLoading && actionId === 'create' ? 'Creating…' : 'Add endpoint'}</Button></div>
      </Panel>

      {error ? <Panel className="border-rose-200 p-6 text-sm text-rose-700">{error}</Panel> : null}
      <Panel className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Endpoints</h2><p className="mt-1 text-sm text-muted">Merchant-scoped webhook destinations.</p></div><span className="text-sm text-muted">{endpointMeta.total || 0} total</span></div>
        {loading ? <div className="text-sm text-muted">Loading endpoints…</div> : <SimpleTable headers={['URL', 'Events', 'Status', 'Created', 'Actions']} rows={items.map((endpoint) => [
          <div key={endpoint.id}><div className="max-w-xs truncate font-medium">{endpoint.url}</div><div className="text-xs text-muted">{compact(endpoint.id)}</div></div>,
          <div key={`${endpoint.id}-events`} className="max-w-sm text-xs text-muted">{endpoint.events.join(', ')}</div>,
          <Badge key={`${endpoint.id}-status`} tone={tone(endpoint.status)}>{endpoint.status}</Badge>,
          dateTime(endpoint.createdAt),
          <div key={`${endpoint.id}-actions`} className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void test(endpoint.id)} disabled={actionLoading}>{endpointBusy(endpoint.id) && actionType === 'test' ? 'Testing…' : 'Test'}</Button>
            <Button variant="ghost" onClick={() => void rotateSecret(endpoint.id)} disabled={actionLoading}>{endpointBusy(endpoint.id) && actionType === 'rotate' ? 'Rotating…' : 'Rotate secret'}</Button>
            {endpoint.status === 'ACTIVE' ? <Button variant="ghost" onClick={() => void disable(endpoint.id)} disabled={actionLoading}>{endpointBusy(endpoint.id) && actionType === 'disable' ? 'Disabling…' : 'Disable'}</Button> : null}
          </div>,
        ])} emptyText="No webhook endpoints yet." />}
        <Paginator page={endpointMeta.page || page} totalPages={endpointMeta.totalPages || 1} onPrev={() => setPage((current) => Math.max(1, current - 1))} onNext={() => setPage((current) => Math.min(endpointMeta.totalPages || 1, current + 1))} />
      </Panel>

      <Panel className="p-6">
        <div className="mb-5"><h2 className="text-lg font-semibold">Delivery history</h2><p className="mt-1 text-sm text-muted">Inspect attempts, provider responses, and failed deliveries.</p></div>
        <div className="mb-5 grid gap-4 md:grid-cols-2"><FieldRow label="Status"><Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">All statuses</option><option value="PENDING">Pending</option><option value="SUCCEEDED">Succeeded</option><option value="FAILED">Failed</option></Select></FieldRow><FieldRow label="Event type"><Input value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} placeholder="payment.succeeded" /></FieldRow></div>
        {deliveryError ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{deliveryError}</div> : null}
        {deliveryLoading ? <div className="text-sm text-muted">Loading deliveries…</div> : <SimpleTable headers={['Delivery', 'Event', 'Status', 'Attempts', 'Response', 'Created', 'Delivered']} rows={filteredDeliveries.map((delivery) => [
          <button key={delivery.id} type="button" className="font-medium text-brand hover:underline" onClick={() => void selectDelivery(delivery.id)} disabled={detailLoading}>{compact(delivery.id)}</button>,
          delivery.eventType,
          <Badge key={`${delivery.id}-status`} tone={tone(delivery.status)}>{delivery.status}</Badge>,
          delivery.attempts,
          delivery.responseCode ? `${delivery.responseCode}${delivery.responseBody ? ` — ${delivery.responseBody.slice(0, 60)}` : ''}` : '—',
          dateTime(delivery.createdAt),
          delivery.deliveredAt ? dateTime(delivery.deliveredAt) : '—',
        ])} emptyText="No webhook deliveries match the selected filters." />}
        <Paginator page={deliveryMeta.page || deliveryPage} totalPages={deliveryMeta.totalPages || 1} onPrev={() => setDeliveryPage((current) => Math.max(1, current - 1))} onNext={() => setDeliveryPage((current) => Math.min(deliveryMeta.totalPages || 1, current + 1))} />
      </Panel>

      {selected ? <Panel className="p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Delivery details</h2><p className="mt-1 text-sm text-muted">{compact(selected.id)}</p></div><Button variant="ghost" onClick={() => setSelected(null)} disabled={actionLoading}>Close</Button></div>
        {detailLoading ? <div className="mt-5 text-sm text-muted">Loading…</div> : null}
        {!detailLoading ? <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><div><div className="text-xs uppercase tracking-wide text-muted">Event</div><div className="mt-1 font-semibold">{selected.eventType}</div></div><div><div className="text-xs uppercase tracking-wide text-muted">Status</div><div className="mt-1"><Badge tone={tone(selected.status)}>{selected.status}</Badge></div></div><div><div className="text-xs uppercase tracking-wide text-muted">Attempts</div><div className="mt-1 font-semibold">{selected.attempts}</div></div><div><div className="text-xs uppercase tracking-wide text-muted">Response</div><div className="mt-1">{selected.responseCode || '—'}</div></div></div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2"><div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Payload</div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-100">{JSON.stringify(selected.payload, null, 2)}</pre></div><div><div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Response body</div><pre className="max-h-96 overflow-auto rounded-xl bg-slate-50 p-4 text-xs text-ink">{selected.responseBody || 'No response body recorded.'}</pre></div></div>
          <div className="mt-6 flex justify-end">{selected.status !== 'SUCCEEDED' ? <Button onClick={() => void retryDelivery()} disabled={actionLoading}>{actionLoading && actionId === selected.id ? 'Retrying…' : 'Retry delivery'}</Button> : null}</div>
        </> : null}
      </Panel> : null}
    </div>
  );
}
