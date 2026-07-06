import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { ApiKeyRecord } from '@/lib/types';
import { Badge, Button, CopyButton, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, SimpleTable } from '@/components/blocks';

type CreateKeyForm = {
  name: string;
  environment: 'SANDBOX' | 'LIVE';
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [createdKey, setCreatedKey] = useState('');
  const { register, handleSubmit, reset } = useForm<CreateKeyForm>({ defaultValues: { name: '', environment: 'SANDBOX' } });

  const load = () => api.get<ApiKeyRecord[]>('/api-keys').then(({ data }) => setKeys(data));

  useEffect(() => {
    load();
  }, []);

  const createKey = async (values: CreateKeyForm) => {
    const { data } = await api.post<any>('/api-keys', values);
    setCreatedKey(data.apiKey);
    reset({ name: '', environment: 'SANDBOX' });
    load();
  };

  const revoke = async (id: string) => {
    await api.patch(`/api-keys/${id}/revoke`);
    load();
  };

  const rows = keys.map((key) => [
    key.name,
    key.environment,
    <Badge key={key.id} tone={key.status === 'ACTIVE' ? 'green' : 'neutral'}>{key.status}</Badge>,
    key.maskedKey || `${key.prefix}...`,
    <Button key={`${key.id}-revoke`} type="button" variant="danger" onClick={() => revoke(key.id)}>
      Revoke
    </Button>,
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="API keys" description="Create and revoke merchant API keys." />
      {createdKey ? (
        <Panel className="p-4">
          <div className="text-sm text-muted">New API key. This full value is only shown once.</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-panelAlt px-3 py-2 text-sm">{createdKey}</code>
            <CopyButton value={createdKey} />
          </div>
        </Panel>
      ) : null}
      <Panel className="p-6">
        <form className="grid gap-4 md:grid-cols-[1fr_220px_auto]" onSubmit={handleSubmit(createKey)}>
          <FieldRow label="Name">
            <Input placeholder="Dashboard key" {...register('name', { required: true })} />
          </FieldRow>
          <FieldRow label="Environment">
            <Select {...register('environment')}>
              <option value="SANDBOX">SANDBOX</option>
              <option value="LIVE">LIVE</option>
            </Select>
          </FieldRow>
          <div className="flex items-end">
            <Button type="submit">Create key</Button>
          </div>
        </form>
      </Panel>
      <SimpleTable headers={['Name', 'Environment', 'Status', 'Masked key', 'Actions']} rows={rows} emptyText="No API keys yet." />
    </div>
  );
}
