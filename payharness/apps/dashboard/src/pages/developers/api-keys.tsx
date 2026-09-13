import { useCallback, useEffect, useState } from 'react';
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

function formatError(error: unknown, fallback = 'Something went wrong. Please check your connection and try again.') {
  if (error instanceof ApiError) {
    return error.message;
  }
  return fallback;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [createdKey, setCreatedKey] = useState('');
  const [createError, setCreateError] = useState('');
  const [status, setStatus] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateKeyForm>({ defaultValues: { name: '', environment: 'SANDBOX' } });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data } = await api.get<ApiKeyRecord[]>('/api-keys');
      setKeys(data);
    } catch (err) {
      setLoadError(formatError(err, 'Unable to load API keys.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const createKey = async (values: CreateKeyForm) => {
    setCreateError('');
    setStatus('');
    setCreatedKey('');
    const name = values.name.trim();
    if (!name) {
      setCreateError('Name is required.');
      return;
    }

    try {
      const { data } = await api.post<{ apiKey: string }>('/api-keys', {
        name,
        environment: values.environment,
      });
      setCreatedKey(data.apiKey);
      reset({ name: '', environment: 'SANDBOX' });
      setStatus('API key created successfully.');
      await load();
    } catch (err) {
      setCreateError(formatError(err, 'Unable to create the API key.'));
    }
  };

  const revoke = async (id: string, name: string) => {
    if (!window.confirm(`Revoke API key “${name}”? This cannot be undone.`)) {
      return;
    }

    setBusyId(id);
    setLoadError('');
    setStatus('');
    try {
      await api.patch(`/api-keys/${id}/revoke`);
      setStatus(`API key “${name}” was revoked.`);
      await load();
    } catch (err) {
      setLoadError(formatError(err, 'Unable to revoke the API key.'));
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
        disabled={busyId !== null || loading || isSubmitting}
        onClick={() => void revoke(key.id, key.name)}
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

      {loading ? <Panel className="p-4 text-sm text-muted">Loading API keys...</Panel> : null}
      {loadError ? <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{loadError}</Panel> : null}
      {status ? <Panel className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{status}</Panel> : null}

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
            <Button variant="ghost" type="button" onClick={() => setCreatedKey('')}>
              Done
            </Button>
          </div>
        </Panel>
      ) : null}

      <Panel className="p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={handleSubmit(createKey)} noValidate>
          <FieldRow label="Name">
            <Input
              placeholder="Dashboard key"
              disabled={loading || isSubmitting}
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name ? <div className="mt-1 text-xs text-rose-700">{errors.name.message}</div> : null}
          </FieldRow>
          <FieldRow label="Environment">
            <Select {...register('environment')} disabled={loading || isSubmitting}>
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </FieldRow>
          <div className="flex items-end">
            <Button type="submit" disabled={loading || isSubmitting || busyId !== null}>
              {isSubmitting ? 'Generating…' : 'Generate API Key'}
            </Button>
          </div>
          {createError ? <div className="md:col-span-3 text-sm text-rose-700">{createError}</div> : null}
        </form>
      </Panel>

      <SimpleTable
        headers={['Name', 'Environment', 'Status', 'Prefix', 'Created', 'Last Used', 'Actions']}
        rows={rows}
        emptyText={loading ? 'Loading API keys...' : 'No API keys yet.'}
      />
    </div>
  );
}
