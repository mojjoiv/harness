import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
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
};

export default function GeneralSettingsPage() {
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset } = useForm<MerchantSettings>({ defaultValues: emptySettings });

  useEffect(() => {
    api.get<MerchantSettings>('/merchant/settings').then(({ data }) => reset(data));
  }, [reset]);

  const onSubmit = async (values: MerchantSettings) => {
    setStatus('Saving...');
    await api.patch('/merchant/settings', values);
    setStatus('Saved');
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="General settings" description="Currency, timeouts, customer requirements, and receipts." />
      <Panel className="p-6">
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
          <div className="flex items-center gap-3">
            <Button type="submit">Save settings</Button>
            <div className="text-sm text-muted">{status}</div>
          </div>
        </form>
      </Panel>
    </div>
  );
}
