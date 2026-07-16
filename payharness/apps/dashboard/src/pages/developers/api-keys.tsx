import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, api } from '@/lib/api';
import { ApiKeyRecord } from '@/lib/types';
import { Badge, Button, CopyButton, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, SimpleTable } from '@/components/blocks';
import { dateTime } from '@/lib/format';

type CreateKeyForm = {
  name: string;
  environment: 'SANDBOX' | 'LIVE';
};

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }
  return 'Something went wrong. Please check your connection and try again.';
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loadError, setLoadError] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [createError, setCreateError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateKeyForm>({ defaultValues: { name: '', environment: 'SANDBOX' } });

  const load = () => {
    setLoadError('');
    return api
      .get<ApiKeyRecord[]>('/api-keys')
      .then(({ data }) => setKeys(data))
      .catch((err) => setLoadError(formatError(err)));
  };

  useEffect(() => {
    load();
  }, []);

  const createKey = async (values: CreateKeyForm) => {
    setCreateError('');
    try {
      const { data } = await api.post<{ apiKey: string }>('/api-keys', values);
      setCreatedKey(data.apiKey);
      reset({ name: '', environment: 'SANDBOX' });
      await load();
    } catch (err) {
      setCreateError(formatError(err));
    }
  };

  const revoke = async (id: string) => {
    setBusyId(id);
    setLoadError('');
    try {
      await api.patch(`/api-keys/${id}/revoke`);
      await load();
    } catch (err) {
      setLoadError(formatError(err));
    } finally {
      setBusyId(null);
    }
  };

  const rows = keys.map((key) => [
    key.name,
    key.environment,
    <Badge key={key.id} tone={key.status === 'ACTIVE' ? 'green' : 'neutral'}>
      {key.status}
    </Badge>,
    key.maskedKey || `${key.prefix}...`,
    dateTime(key.createdAt),
    key.lastUsedAt ? dateTime(key.lastUsedAt) : 'Never',
    key.status === 'ACTIVE' ? (
      <Button
        key={`${key.id}-revoke`}
        type="button"
        variant="danger"
        disabled={busyId === key.id}
        onClick={() => revoke(key.id)}
      >
        {busyId === key.id ? 'Revoking…' : 'Revoke'}
      </Button>
    ) : (
      <span key={`${key.id}-revoked`} className="text-sm text-muted">
        —
      </span>
    ),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="API keys" description="Create and revoke merchant API keys." />

      {loadError ? <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</Panel> : null}

      {createdKey ? (
        <Panel className="border-emerald-200 bg-emerald-50 p-5">
          <div className="text-base font-semibold text-emerald-900">API Key Created</div>
          <p className="mt-1 text-sm text-emerald-900">
            Copy this key now. For security reasons it will never be shown again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-white px-3 py-2 text-sm">{createdKey}</code>
            <CopyButton value={createdKey} />
          </div>
          <div className="mt-3">
            <Button variant="ghost" onClick={() => setCreatedKey('')}>
              Done
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={handleSubmit(createKey)} noValidate>
          <FieldRow label="Name">
            <Input placeholder="Dashboard key" {...register('name', { required: 'Name is required' })} />
            {errors.name ? <div className="mt-1 text-xs text-rose-700">{errors.name.message}</div> : null}
          </FieldRow>
          <FieldRow label="Environment">
            <Select {...register('environment')}>
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </FieldRow>
          <div className="flex items-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Generating…' : 'Generate API Key'}
            </Button>
          </div>
          {createError ? (
            <div className="md:col-span-3 text-sm text-rose-700">{createError}</div>
          ) : null}
        </form>
      </Panel>

      <SimpleTable
        headers={['Name', 'Environment', 'Status', 'Prefix', 'Created', 'Last Used', 'Actions']}
        rows={rows}
        emptyText="No API keys yet."
      />
    </div>
  );
}
