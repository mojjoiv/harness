import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { CheckoutSessionRecord } from '@/lib/types';
import { Button, CopyButton, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, FormGrid, SimpleTable } from '@/components/blocks';
import { money, dateTime } from '@/lib/format';

type FormValues = {
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  allowedProviders?: ('MPESA' | 'STRIPE' | 'PAYPAL')[];
};

export default function CheckoutSessionsPage() {
  const [sessions, setSessions] = useState<CheckoutSessionRecord[]>([]);
  const [createdUrl, setCreatedUrl] = useState('');
  const { register, handleSubmit, reset } = useForm<FormValues>({
    defaultValues: { amountCents: 1000, currency: 'KES', successUrl: '', cancelUrl: '' },
  });

  const load = () => api.get<CheckoutSessionRecord[]>('/checkout-sessions').then(({ data }) => setSessions(data));

  useEffect(() => {
    load();
  }, []);

  const create = async (values: FormValues) => {
    const payload = {
      amountCents: values.amountCents,
      currency: values.currency,
      successUrl: values.successUrl,
      cancelUrl: values.cancelUrl,
      customer: values.customer,
      allowedProviders: values.allowedProviders || [],
    };
    const { data } = await api.post<CheckoutSessionRecord>('/checkout-sessions', payload);
    setCreatedUrl(data.checkoutUrl);
    reset({ amountCents: 1000, currency: 'KES', successUrl: '', cancelUrl: '' });
    load();
  };

  const rows = sessions.map((session) => [
    session.id,
    money(session.amountCents, session.currency),
    session.status,
    dateTime(session.createdAt),
    <div key={`${session.id}-actions`} className="flex flex-wrap gap-2">
      <code className="rounded-lg bg-panelAlt px-2 py-1 text-xs">{session.checkoutUrl}</code>
      <CopyButton value={session.checkoutUrl} label="Copy URL" />
    </div>,
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Checkout sessions" description="Create hosted checkout sessions and copy their checkout URLs." />
      {createdUrl ? (
        <Panel className="p-4">
          <div className="text-sm text-muted">Latest checkout URL</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-xl bg-panelAlt px-3 py-2 text-sm">{createdUrl}</code>
            <CopyButton value={createdUrl} />
          </div>
        </Panel>
      ) : null}
      <Panel className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit(create)}>
          <FormGrid>
            <FieldRow label="Amount cents"><Input type="number" min={1} {...register('amountCents', { valueAsNumber: true })} /></FieldRow>
            <FieldRow label="Currency"><Input {...register('currency')} /></FieldRow>
            <FieldRow label="Success URL"><Input {...register('successUrl')} /></FieldRow>
            <FieldRow label="Cancel URL"><Input {...register('cancelUrl')} /></FieldRow>
            <FieldRow label="Customer name"><Input {...register('customer.name')} /></FieldRow>
            <FieldRow label="Customer email"><Input type="email" {...register('customer.email')} /></FieldRow>
            <FieldRow label="Customer phone"><Input {...register('customer.phone')} /></FieldRow>
            <FieldRow label="Allowed providers">
              <Select multiple size={3} {...register('allowedProviders')}>
                <option value="MPESA">MPESA</option>
                <option value="STRIPE">STRIPE</option>
                <option value="PAYPAL">PAYPAL</option>
              </Select>
            </FieldRow>
          </FormGrid>
          <Button type="submit">Create checkout session</Button>
        </form>
      </Panel>
      <SimpleTable headers={['ID', 'Amount', 'Status', 'Created', 'Checkout URL']} rows={rows} emptyText="No checkout sessions yet." />
    </div>
  );
}
