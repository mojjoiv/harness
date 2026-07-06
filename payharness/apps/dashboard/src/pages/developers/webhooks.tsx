import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { Button, CopyButton, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, SimpleTable } from '@/components/blocks';
import { PaginationMeta, WebhookEndpointRecord } from '@/lib/types';
import { dateTime } from '@/lib/format';

type FormValues = {
  url: string;
  events: string;
};

export default function WebhooksPage() {
  const [items, setItems] = useState<WebhookEndpointRecord[]>([]);
  const [secret, setSecret] = useState('');
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const { register, handleSubmit, reset } = useForm<FormValues>();

  const load = async (currentPage = page) => {
    const { data, meta } = await api.get<WebhookEndpointRecord[]>(`/webhooks/endpoints?page=${currentPage}&limit=20`);
    setItems(data);
    setMeta(meta);
  };

  useEffect(() => {
    load();
  }, [page]);

  const create = async (values: FormValues) => {
    const { data } = await api.post<WebhookEndpointRecord>('/webhooks/endpoints', {
      url: values.url,
      events: values.events.split(',').map((event) => event.trim()).filter(Boolean),
    });
    setSecret(data.secret || '');
    reset();
    load(1);
  };

  const disable = async (id: string) => {
    await api.patch(`/webhooks/endpoints/${id}/disable`);
    load();
  };

  const test = async (id: string) => {
    await api.post(`/webhooks/endpoints/${id}/test`);
  };

  const rows = items.map((endpoint) => [
    endpoint.url,
    endpoint.events.join(', '),
    endpoint.status,
    dateTime(endpoint.createdAt),
    <div key={`${endpoint.id}-actions`} className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={() => test(endpoint.id)}>Test</Button>
      <Button type="button" variant="danger" onClick={() => disable(endpoint.id)}>Disable</Button>
    </div>,
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Webhooks" description="Create, test, and disable webhook endpoints." />
      {secret ? (
        <Panel className="p-4">
          <div className="text-sm text-muted">Webhook secret is shown once.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-panelAlt px-3 py-2 text-sm">{secret}</code>
            <CopyButton value={secret} />
          </div>
        </Panel>
      ) : null}
      <Panel className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit(create)}>
          <FieldRow label="URL"><Input {...register('url', { required: true })} /></FieldRow>
          <FieldRow label="Events"><Input placeholder="payment.succeeded, checkout.completed" {...register('events', { required: true })} /></FieldRow>
          <Button type="submit">Create endpoint</Button>
        </form>
      </Panel>
      <SimpleTable headers={['URL', 'Events', 'Status', 'Created', 'Actions']} rows={rows} emptyText="No webhook endpoints yet." />
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-muted">
          Page {meta.page || page} of {meta.totalPages || 1}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</Button>
          <Button type="button" variant="secondary" onClick={() => setPage((p) => p + 1)} disabled={page >= (meta.totalPages || 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}
