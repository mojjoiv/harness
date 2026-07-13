import { useCallback, useEffect, useMemo, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { FieldRow, FormGrid, SimpleTable } from '@/components/blocks';
import { Badge, Button, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { COUNTRY_CURRENCIES, currencyForCountry } from '@/lib/countries';
import { money } from '@/lib/format';
import { PlanRecord } from '@/lib/types';

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'red' | 'blue'> = {
  ACTIVE: 'green',
  SUSPENDED: 'red',
  ARCHIVED: 'neutral',
};

interface PlanFormState {
  id?: string;
  name: string;
  code: string;
  countryCode: string;
  priceUsd: string;
  annualPriceUsd: string;
  apiRequestLimit: string;
  transactionLimit: string;
  userLimit: string;
  storageLimitMb: string;
  webhookLimit: string;
}

const EMPTY_FORM: PlanFormState = {
  name: '',
  code: '',
  countryCode: 'US',
  priceUsd: '',
  annualPriceUsd: '',
  apiRequestLimit: '',
  transactionLimit: '',
  userLimit: '',
  storageLimitMb: '',
  webhookLimit: '',
};

function toOptionalInt(value: string) {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(0, parsed);
}

export default function PlatformPlansPage() {
  const [items, setItems] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PlanFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({});
  const [ratesLoaded, setRatesLoaded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [plansRes, ratesRes] = await Promise.all([
        api.get<PlanRecord[]>('/platform/plans'),
        api.get<{ base: string; rates: Record<string, number> }>('/platform/exchange-rates'),
      ]);
      setItems(plansRes.data);
      setRates(ratesRes.data.rates || {});
      setRatesLoaded(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const currency = currencyForCountry(form.countryCode);
  const rate = rates[currency] || (currency === 'USD' ? 1 : undefined);

  const convertedMonthly = useMemo(() => {
    const usd = Number(form.priceUsd);
    if (!rate || !Number.isFinite(usd) || usd <= 0) return null;
    return usd * rate;
  }, [form.priceUsd, rate]);

  const convertedAnnual = useMemo(() => {
    const usd = Number(form.annualPriceUsd);
    if (!rate || !Number.isFinite(usd) || usd <= 0) return null;
    return usd * rate;
  }, [form.annualPriceUsd, rate]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (plan: PlanRecord) => {
    const planRate = rates[plan.currency] || (plan.currency === 'USD' ? 1 : undefined);
    const matchingCountry = COUNTRY_CURRENCIES.find((c) => c.currency === plan.currency);
    const toUsd = (cents: number) => (planRate ? cents / 100 / planRate : cents / 100);

    setForm({
      id: plan.id,
      name: plan.name,
      code: plan.code,
      countryCode: matchingCountry?.countryCode || 'US',
      priceUsd: toUsd(plan.priceCents).toFixed(2),
      annualPriceUsd: plan.annualPriceCents != null ? toUsd(plan.annualPriceCents).toFixed(2) : '',
      apiRequestLimit: plan.apiRequestLimit != null ? String(plan.apiRequestLimit) : '',
      transactionLimit: plan.transactionLimit != null ? String(plan.transactionLimit) : '',
      userLimit: plan.userLimit != null ? String(plan.userLimit) : '',
      storageLimitMb: plan.storageLimitMb != null ? String(plan.storageLimitMb) : '',
      webhookLimit: plan.webhookLimit != null ? String(plan.webhookLimit) : '',
    });
    setFormError('');
    setShowForm(true);
  };

  const submitForm = async () => {
    if (!rate) {
      setFormError(`No exchange rate available for ${currency} yet -- try again in a moment.`);
      return;
    }

    setSaving(true);
    setFormError('');

    const priceCents = Math.max(0, Math.round(Number(form.priceUsd || 0) * rate * 100));
    const annualPriceCents = form.annualPriceUsd.trim()
      ? Math.max(0, Math.round(Number(form.annualPriceUsd) * rate * 100))
      : undefined;

    const basePayload = {
      name: form.name,
      priceCents,
      annualPriceCents,
      currency,
      apiRequestLimit: toOptionalInt(form.apiRequestLimit),
      transactionLimit: toOptionalInt(form.transactionLimit),
      userLimit: toOptionalInt(form.userLimit),
      storageLimitMb: toOptionalInt(form.storageLimitMb),
      webhookLimit: toOptionalInt(form.webhookLimit),
    };

    try {
      if (form.id) {
        // code is immutable after creation -- UpdatePlanDto doesn't accept it,
        // and the API rejects unknown properties.
        await api.patch(`/platform/plans/${form.id}`, basePayload);
      } else {
        await api.post('/platform/plans', { ...basePayload, code: form.code });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Failed to save plan.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: 'suspend' | 'reactivate' | 'delete') => {
    setBusyId(id);
    setError('');
    try {
      if (action === 'delete') {
        await api.delete(`/platform/plans/${id}`);
      } else {
        await api.patch(`/platform/plans/${id}/${action}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} plan.`);
    } finally {
      setBusyId(null);
    }
  };

  const rows = items.map((plan) => {
    const isBusy = busyId === plan.id;
    const hasSubscribers = plan._count.subscriptions > 0;

    return [
      plan.name,
      plan.code,
      money(plan.priceCents, plan.currency),
      plan.annualPriceCents != null ? money(plan.annualPriceCents, plan.currency) : '—',
      plan._count.subscriptions,
      <Badge key="status" tone={STATUS_TONE[plan.status] || 'neutral'}>
        {plan.status}
      </Badge>,
      <div key="actions" className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={isBusy} onClick={() => openEdit(plan)}>
          Edit
        </Button>
        {plan.status === 'ACTIVE' ? (
          <Button variant="secondary" disabled={isBusy} onClick={() => runAction(plan.id, 'suspend')}>
            Suspend
          </Button>
        ) : (
          <Button variant="primary" disabled={isBusy} onClick={() => runAction(plan.id, 'reactivate')}>
            Reactivate
          </Button>
        )}
        <Button
          variant="danger"
          disabled={isBusy || hasSubscribers}
          title={hasSubscribers ? 'Plan has active subscribers and cannot be deleted' : undefined}
          onClick={() => runAction(plan.id, 'delete')}
        >
          Delete
        </Button>
      </div>,
    ];
  });

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle
          title="Subscription Plans"
          description="Plans available for merchants on the platform. Prices are entered in USD and converted to the merchant's local currency using the current exchange rate."
          action={<Button onClick={openCreate}>Create Plan</Button>}
        />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}

        {showForm ? (
          <Panel className="mb-4 p-6">
            <h2 className="mb-4 text-lg font-semibold text-ink">{form.id ? 'Edit Plan' : 'Create Plan'}</h2>
            {formError ? <div className="mb-4 text-sm text-rose-700">{formError}</div> : null}
            {!ratesLoaded ? (
              <div className="mb-4 text-sm text-muted">Loading current exchange rates…</div>
            ) : null}
            <FormGrid>
              <FieldRow label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </FieldRow>
              <FieldRow label="Code">
                <Input
                  value={form.code}
                  disabled={Boolean(form.id)}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Country" hint="Determines the merchant-facing currency">
                <Select
                  value={form.countryCode}
                  onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                >
                  {COUNTRY_CURRENCIES.map((c) => (
                    <option key={c.countryCode} value={c.countryCode}>
                      {c.country} ({c.currency})
                    </option>
                  ))}
                </Select>
              </FieldRow>
              <FieldRow label="Currency">
                <Input value={currency} disabled />
              </FieldRow>
              <FieldRow
                label="Monthly Price (USD)"
                hint={convertedMonthly != null ? `≈ ${money(Math.round(convertedMonthly * 100), currency)}` : undefined}
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.priceUsd}
                  onChange={(e) => setForm({ ...form, priceUsd: e.target.value })}
                />
              </FieldRow>
              <FieldRow
                label="Annual Price (USD)"
                hint={
                  convertedAnnual != null
                    ? `≈ ${money(Math.round(convertedAnnual * 100), currency)}`
                    : 'Optional'
                }
              >
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.annualPriceUsd}
                  onChange={(e) => setForm({ ...form, annualPriceUsd: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="API Request Limit" hint="Leave blank for unlimited">
                <Input
                  type="number"
                  min={0}
                  value={form.apiRequestLimit}
                  onChange={(e) => setForm({ ...form, apiRequestLimit: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Transaction Limit" hint="Leave blank for unlimited">
                <Input
                  type="number"
                  min={0}
                  value={form.transactionLimit}
                  onChange={(e) => setForm({ ...form, transactionLimit: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="User Limit" hint="Leave blank for unlimited">
                <Input
                  type="number"
                  min={0}
                  value={form.userLimit}
                  onChange={(e) => setForm({ ...form, userLimit: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Storage Limit (MB)" hint="Leave blank for unlimited">
                <Input
                  type="number"
                  min={0}
                  value={form.storageLimitMb}
                  onChange={(e) => setForm({ ...form, storageLimitMb: e.target.value })}
                />
              </FieldRow>
              <FieldRow label="Webhook Limit" hint="Leave blank for unlimited">
                <Input
                  type="number"
                  min={0}
                  value={form.webhookLimit}
                  onChange={(e) => setForm({ ...form, webhookLimit: e.target.value })}
                />
              </FieldRow>
            </FormGrid>
            <div className="mt-4 flex gap-2">
              <Button disabled={saving || !ratesLoaded} onClick={submitForm}>
                {saving ? 'Saving…' : 'Save Plan'}
              </Button>
              <Button variant="ghost" disabled={saving} onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </Panel>
        ) : null}

        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading plans…</Panel>
        ) : (
          <SimpleTable
            headers={['Plan', 'Code', 'Monthly Price', 'Annual Price', 'Subscribers', 'Status', 'Actions']}
            rows={rows}
            emptyText="No plans yet."
          />
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
