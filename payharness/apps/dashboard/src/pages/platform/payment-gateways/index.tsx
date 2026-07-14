import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { SimpleTable } from '@/components/blocks';
import { Badge, Button, Panel, SectionTitle, Select } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { COUNTRY_CURRENCIES } from '@/lib/countries';
import { dateTime } from '@/lib/format';
import { PlatformGatewayRecord, ProviderCountryAvailabilityRecord } from '@/lib/types';

const PROVIDER_LABELS: Record<string, string> = {
  MPESA: 'M-Pesa',
  STRIPE: 'Stripe',
  PAYPAL: 'PayPal',
};

const countryName = (code: string) => COUNTRY_CURRENCIES.find((c) => c.countryCode === code)?.country || code;

export default function PlatformPaymentGatewaysPage() {
  const [items, setItems] = useState<PlatformGatewayRecord[]>([]);
  const [matrix, setMatrix] = useState<ProviderCountryAvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [gatewaysRes, matrixRes] = await Promise.all([
        api.get<PlatformGatewayRecord[]>('/platform/gateways'),
        api.get<ProviderCountryAvailabilityRecord[]>('/provider-availability/matrix'),
      ]);
      setItems(gatewaysRes.data);
      setMatrix(matrixRes.data);
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

  const toggleCountryRow = async (row: ProviderCountryAvailabilityRecord) => {
    setBusyRow(row.id);
    setError('');
    try {
      await api.patch(`/provider-availability/${row.provider}/${row.countryCode}/toggle`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update country availability.');
    } finally {
      setBusyRow(null);
    }
  };

  const rows = items.map((gateway) => [
    PROVIDER_LABELS[gateway.provider] || gateway.provider,
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

  const filteredMatrix = useMemo(
    () => (providerFilter === 'ALL' ? matrix : matrix.filter((row) => row.provider === providerFilter)),
    [matrix, providerFilter],
  );

  const matrixRows = filteredMatrix.map((row) => [
    PROVIDER_LABELS[row.provider] || row.provider,
    countryName(row.countryCode),
    <Badge key="status" tone={row.enabled ? 'green' : 'red'}>
      {row.enabled ? 'Available' : 'Blocked'}
    </Badge>,
    <Button
      key="toggle"
      variant={row.enabled ? 'danger' : 'primary'}
      disabled={busyRow === row.id}
      onClick={() => toggleCountryRow(row)}
    >
      {row.enabled ? 'Block' : 'Allow'}
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
          <>
            <SimpleTable
              headers={['Provider', 'Status', 'Last Updated', 'Actions']}
              rows={rows}
              emptyText="No gateways configured yet."
            />

            <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">
              Country Availability
            </h2>
            <p className="mb-4 text-sm text-muted">
              Which countries each provider is available in -- e.g. M-Pesa should only show as available in
              East African markets, not the US. A merchant only sees payment methods available in their own
              country, both at signup and when connecting a provider.
            </p>
            <div className="mb-4 max-w-xs">
              <Select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
                <option value="ALL">All providers</option>
                <option value="MPESA">M-Pesa</option>
                <option value="STRIPE">Stripe</option>
                <option value="PAYPAL">PayPal</option>
              </Select>
            </div>
            <SimpleTable
              headers={['Provider', 'Country', 'Status', 'Actions']}
              rows={matrixRows}
              emptyText="No country availability configured yet."
            />
          </>
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
