import { useCallback, useEffect, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { SimpleTable } from '@/components/blocks';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PlatformGatewayRecord } from '@/lib/types';

export default function PlatformPaymentGatewaysPage() {
  const [items, setItems] = useState<PlatformGatewayRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlatformGatewayRecord[]>('/platform/gateways');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load payment gateways.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (provider: string) => {
    setBusyProvider(provider);
    setError('');
    try {
      await api.patch(`/platform/gateways/${provider}/toggle`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update gateway.');
    } finally {
      setBusyProvider(null);
    }
  };

  const rows = items.map((gateway) => [
    gateway.provider,
    <Badge key="status" tone={gateway.enabled ? 'green' : 'red'}>
      {gateway.enabled ? 'Enabled' : 'Disabled'}
    </Badge>,
    dateTime(gateway.updatedAt),
    <Button
      key="toggle"
      variant={gateway.enabled ? 'danger' : 'primary'}
      disabled={busyProvider === gateway.provider}
      onClick={() => toggle(gateway.provider)}
    >
      {gateway.enabled ? 'Disable' : 'Enable'}
    </Button>,
  ]);

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle
          title="Payment Gateways"
          description="Enable or disable payment providers across the platform. Merchant owners can only connect providers that are enabled here."
        />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading payment gateways…</Panel>
        ) : (
          <SimpleTable
            headers={['Provider', 'Status', 'Last Updated', 'Actions']}
            rows={rows}
            emptyText="No gateways configured yet."
          />
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
