import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError, api } from '@/lib/api';
import { MerchantSettings } from '@/lib/types';
import { Button, Input, Panel, Select, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

const emptySettings: MerchantSettings = {
  defaultCurrency: 'KES',
  defaultEnvironment: 'SANDBOX',
  receiptEmailsEnabled: true,
  webhookRetriesEnabled: true,
  retryCount: 3,
  paymentTimeoutMinutes: 30,
  requireCustomerEmail: false,
  requireCustomerPhone: false,
  successUrl: '',
  cancelUrl: '',
  webhookForwardingUrl: '',
};

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return 'Something went wrong. Please check your connection and try again.';
}

export default function GeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<MerchantSettings>({
    defaultValues: emptySettings,
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');

    api
      .get<MerchantSettings>('/merchant/settings')
      .then(({ data }) => {
        if (active) reset(data);
      })
      .catch((error) => {
        if (active) setLoadError(formatError(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reset]);

  const onSubmit = async (values: MerchantSettings) => {
    setStatus('');
    setSaveError('');
    const settingsPayload = {
      defaultCurrency: values.defaultCurrency,
      defaultEnvironment: values.defaultEnvironment,
      receiptEmailsEnabled: values.receiptEmailsEnabled,
      webhookRetriesEnabled: values.webhookRetriesEnabled,
      retryCount: values.retryCount,
      paymentTimeoutMinutes: values.paymentTimeoutMinutes,
      requireCustomerEmail: values.requireCustomerEmail,
      requireCustomerPhone: values.requireCustomerPhone,
      successUrl: values.successUrl,
      cancelUrl: values.cancelUrl,
      webhookForwardingUrl: values.webhookForwardingUrl,
    };

    try {
      await api.patch('/merchant/settings', settingsPayload);
      setStatus('Settings saved successfully.');
    } catch (error) {
      setSaveError(formatError(error));
    }
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="General settings" description="Currency, timeouts, customer requirements, and receipts." />

      {loadError ? (
        <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {loadError}
        </Panel>
      ) : null}

      {saveError ? (
        <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {saveError}
        </Panel>
      ) : null}

      {status ? (
        <Panel className="border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {status}
        </Panel>
      ) : null}

      <Panel className="p-6">
        {loading ? (
          <div className="text-sm text-muted">Loading settings…</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <FormGrid>
              <FieldRow label="Default currency"><Input {...register('defaultCurrency')} /></FieldRow>
              <FieldRow label="Default environment">
                <Select {...register('defaultEnvironment')}>
                  <option value="SANDBOX">SANDBOX</option>
                  <option value="LIVE">LIVE</option>
                </Select>
              </FieldRow>
              <FieldRow label="Receipt emails enabled">
                <Select {...register('receiptEmailsEnabled', { setValueAs: (value) => value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              </FieldRow>
              <FieldRow label="Webhook retries enabled">
                <Select {...register('webhookRetriesEnabled', { setValueAs: (value) => value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              </FieldRow>
              <FieldRow label="Retry count"><Input type="number" min={0} {...register('retryCount', { valueAsNumber: true })} /></FieldRow>
              <FieldRow label="Payment timeout minutes"><Input type="number" min={1} {...register('paymentTimeoutMinutes', { valueAsNumber: true })} /></FieldRow>
              <FieldRow label="Require customer email">
                <Select {...register('requireCustomerEmail', { setValueAs: (value) => value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              </FieldRow>
              <FieldRow label="Require customer phone">
                <Select {...register('requireCustomerPhone', { setValueAs: (value) => value === 'true' })}>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              </FieldRow>
            </FormGrid>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Checkout URLs</h2>
            <p className="mb-2 text-sm text-muted">
              Where customers land after checkout, and where PayHarness forwards a copy of every webhook event.
            </p>
            <FormGrid>
              <FieldRow label="Success URL" hint="Customer is redirected here after a successful payment">
                <Input placeholder="https://yourapp.com/checkout/success" {...register('successUrl')} />
              </FieldRow>
              <FieldRow label="Cancel URL" hint="Customer is redirected here if they cancel checkout">
                <Input placeholder="https://yourapp.com/checkout/cancel" {...register('cancelUrl')} />
              </FieldRow>
              <FieldRow label="Webhook Forwarding URL" hint="PayHarness forwards a copy of every event here">
                <Input placeholder="https://yourapp.com/webhooks/payharness" {...register('webhookForwardingUrl')} />
              </FieldRow>
            </FormGrid>

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
