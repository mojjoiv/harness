import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

function formatError(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export default function PlatformPaymentGatewaysPage() {
  const [items, setItems] = useState<PlatformGatewayRecord[]>([]);
  const [matrix, setMatrix] = useState<ProviderCountryAvailabilityRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [providerFilter, setProviderFilter] = useState('ALL');
  const requestId = useRef(0);

  const load = useCallback(async (isRefresh = false) => {
    const currentRequest = ++requestId.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [gatewaysRes, matrixRes] = await Promise.all([
        api.get<PlatformGatewayRecord[]>('/platform/gateways'),
        api.get<ProviderCountryAvailabilityRecord[]>('/provider-availability/matrix'),
      ]);
      if (currentRequest !== requestId.current) return;
      setItems(gatewaysRes.data);
      setMatrix(matrixRes.data);
    } catch (err) {
      if (currentRequest !== requestId.current) return;
      setError(formatError(err, 'Failed to load payment gateways.'));
    } finally {
      if (currentRequest !== requestId.current) return;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (provider: string, enabled: boolean) => {
    if (!window.confirm(`${enabled ? 'Disable' : 'Enable'} ${PROVIDER_LABELS[provider] || provider} platform-wide?`)) return;
    setBusyProvider(provider);
    setError('');
    setStatus('');
    try {
      await api.patch(`/platform/gateways/${provider}/toggle`);
      setStatus(`${PROVIDER_LABELS[provider] || provider} gateway updated.`);
      await load(true);
    } catch (err) {
      setError(formatError(err, 'Failed to update gateway.'));
    } finally {
      setBusyProvider(null);
    }
  };

  const toggleCountryRow = async (row: ProviderCountryAvailabilityRecord) => {
    if (!window.confirm(`${row.enabled ? 'Block' : 'Allow'} ${PROVIDER_LABELS[row.provider] || row.provider} in ${countryName(row.countryCode)}?`)) return;
    setBusyRow(row.id);
    setError('');
    setStatus('');
    try {
      await api.patch(`/provider-availability/${row.provider}/${row.countryCode}/toggle`);
      setStatus(`${PROVIDER_LABELS[row.provider] || row.provider} availability updated for ${countryName(row.countryCode)}.`);
      await load(true);
    } catch (err) {
      setError(formatError(err, 'Failed to update country availability.'));
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
      disabled={busyProvider !== null}
      onClick={() => void toggle(gateway.provider, gateway.enabled)}
    >
      {busyProvider === gateway.provider ? 'Working…' : gateway.enabled ? 'Disable' : 'Enable'}
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
      disabled={busyRow !== null}
      onClick={() => void toggleCountryRow(row)}
    >
      {busyRow === row.id ? 'Working…' : row.enabled ? 'Block' : 'Allow'}
    </Button>,
  ]);

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle
          title="Payment Gateways"
          description="Enable or disable payment providers across the platform. Merchant owners can only connect providers that are enabled here."
          action={
            <Button variant="secondary" disabled={loading || refreshing} onClick={() => void load(true)}>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          }
        />
        {error ? (
          <div className="mb-4 mt-4 flex flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <span>{error}</span>
            <Button variant="secondary" disabled={refreshing} onClick={() => void load(true)}>
              {refreshing ? 'Retrying…' : 'Retry'}
            </Button>
          </div>
        ) : null}
        {status ? (
          <div className="mb-4 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700" role="status" aria-live="polite">
            {status}
          </div>
        ) : null}

        {loading ? (
          <div role="status" aria-live="polite">
            <Panel className="p-6 text-sm text-muted">Loading payment gateways…</Panel>
          </div>
        ) : (
          <>
            <SimpleTable
              headers={['Provider', 'Status', 'Last Updated', 'Actions']}
              rows={rows}
              emptyText="No gateways configured yet."
            />

            <h2 className="mb-2 mt-8 text-sm font-semibold uppercase tracking-wide text-muted">Country Availability</h2>
            <p className="mb-4 text-sm text-muted">
              Control which countries each provider can serve. Changes apply platform-wide to merchant provider availability.
            </p>
            <div className="mb-4 max-w-xs">
              <Select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} disabled={busyRow !== null}>
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
