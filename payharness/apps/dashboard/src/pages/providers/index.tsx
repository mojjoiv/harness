import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { ProviderStatus } from '@/lib/types';
import { Badge, Button, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, FormGrid, SimpleTable } from '@/components/blocks';
import { dateTime } from '@/lib/format';

type MpesaForm = {
  environment: 'SANDBOX' | 'LIVE';
  businessType: 'PAYBILL' | 'TILL';
  shortcode: string;
  accountReference?: string;
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
};

type StripeForm = {
  environment: 'SANDBOX' | 'LIVE';
  publishableKey: string;
  secretKey: string;
  webhookSecret?: string;
};

type PaypalForm = {
  environment: 'SANDBOX' | 'LIVE';
  clientId: string;
  clientSecret: string;
  webhookId?: string;
};

function StatusBadge({ connected }: { connected: boolean }) {
  return <Badge tone={connected ? 'green' : 'neutral'}>{connected ? 'Connected' : 'Disconnected'}</Badge>;
}

export default function ProvidersPage() {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [message, setMessage] = useState('');
  const [lastSaved, setLastSaved] = useState<{ provider: string; payload: unknown } | null>(null);
  const mpesa = useForm<MpesaForm>({ defaultValues: { environment: 'SANDBOX', businessType: 'PAYBILL', shortcode: '', accountReference: '', consumerKey: '', consumerSecret: '', passkey: '' } });
  const stripe = useForm<StripeForm>({ defaultValues: { environment: 'SANDBOX', publishableKey: '', secretKey: '', webhookSecret: '' } });
  const paypal = useForm<PaypalForm>({ defaultValues: { environment: 'SANDBOX', clientId: '', clientSecret: '', webhookId: '' } });

  const refresh = () => api.get<ProviderStatus[]>('/providers/status').then(({ data }) => setStatuses(data));

  useEffect(() => {
    refresh();
  }, []);

  const saveMpesa = async (values: MpesaForm) => {
    const { data } = await api.post('/provider-credentials/mpesa', {
      environment: values.environment,
      publicConfig: { businessType: values.businessType, shortcode: values.shortcode, accountReference: values.accountReference || undefined },
      secretConfig: { consumerKey: values.consumerKey, consumerSecret: values.consumerSecret, passkey: values.passkey },
    });
    setLastSaved({ provider: 'M-Pesa', payload: data });
    setMessage('M-Pesa credentials saved');
    refresh();
  };

  const saveStripe = async (values: StripeForm) => {
    const { data } = await api.post('/provider-credentials/stripe', {
      environment: values.environment,
      publicConfig: { publishableKey: values.publishableKey },
      secretConfig: { secretKey: values.secretKey, webhookSecret: values.webhookSecret || undefined },
    });
    setLastSaved({ provider: 'Stripe', payload: data });
    setMessage('Stripe credentials saved');
    refresh();
  };

  const savePaypal = async (values: PaypalForm) => {
    const { data } = await api.post('/provider-credentials/paypal', {
      environment: values.environment,
      publicConfig: { clientId: values.clientId },
      secretConfig: { clientSecret: values.clientSecret, webhookId: values.webhookId || undefined },
    });
    setLastSaved({ provider: 'PayPal', payload: data });
    setMessage('PayPal credentials saved');
    refresh();
  };

  const statusRows = statuses.map((row) => [
    row.provider,
    <StatusBadge key={`${row.provider}-connected`} connected={row.connected} />,
    <Badge key={`${row.provider}-sandbox`} tone={row.sandboxConnected ? 'green' : 'neutral'}>{row.sandboxConnected ? 'Yes' : 'No'}</Badge>,
    <Badge key={`${row.provider}-live`} tone={row.liveConnected ? 'green' : 'neutral'}>{row.liveConnected ? 'Yes' : 'No'}</Badge>,
    <Badge key={`${row.provider}-verified`} tone={row.verified ? 'blue' : 'neutral'}>{row.verified ? 'Verified' : 'Unverified'}</Badge>,
    row.lastUpdatedAt ? dateTime(row.lastUpdatedAt) : 'Never',
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Providers" description="Connection status and credential forms for each provider." />
      <SimpleTable headers={['Provider', 'Connected', 'Sandbox', 'Live', 'Verified', 'Last updated']} rows={statusRows} emptyText="No provider connections yet." />
      {message ? <Panel className="p-4 text-sm text-muted">{message}</Panel> : null}
      {lastSaved ? (
        <Panel className="p-4">
          <div className="text-sm font-medium text-ink">{lastSaved.provider} saved values</div>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-panelAlt p-4 text-xs text-ink">
            {JSON.stringify(lastSaved.payload, null, 2)}
          </pre>
        </Panel>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel className="p-6">
          <div className="mb-4 text-lg font-semibold">M-Pesa</div>
          <form className="space-y-4" onSubmit={mpesa.handleSubmit(saveMpesa)}>
            <FieldRow label="Environment"><Select {...mpesa.register('environment')}><option value="SANDBOX">SANDBOX</option><option value="LIVE">LIVE</option></Select></FieldRow>
            <FormGrid>
              <FieldRow label="Business type"><Select {...mpesa.register('businessType')}><option value="PAYBILL">PAYBILL</option><option value="TILL">TILL</option></Select></FieldRow>
              <FieldRow label="Shortcode"><Input {...mpesa.register('shortcode')} /></FieldRow>
            </FormGrid>
            <FieldRow label="Account reference"><Input {...mpesa.register('accountReference')} /></FieldRow>
            <FormGrid>
              <FieldRow label="Consumer key"><Input {...mpesa.register('consumerKey')} /></FieldRow>
              <FieldRow label="Consumer secret"><Input type="password" {...mpesa.register('consumerSecret')} /></FieldRow>
            </FormGrid>
            <FieldRow label="Passkey"><Input type="password" {...mpesa.register('passkey')} /></FieldRow>
            <Button type="submit">Save M-Pesa</Button>
          </form>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 text-lg font-semibold">Stripe</div>
          <form className="space-y-4" onSubmit={stripe.handleSubmit(saveStripe)}>
            <FieldRow label="Environment"><Select {...stripe.register('environment')}><option value="SANDBOX">SANDBOX</option><option value="LIVE">LIVE</option></Select></FieldRow>
            <FieldRow label="Publishable key"><Input {...stripe.register('publishableKey')} /></FieldRow>
            <FieldRow label="Secret key"><Input type="password" {...stripe.register('secretKey')} /></FieldRow>
            <FieldRow label="Webhook secret"><Input type="password" {...stripe.register('webhookSecret')} /></FieldRow>
            <Button type="submit">Save Stripe</Button>
          </form>
        </Panel>

        <Panel className="p-6">
          <div className="mb-4 text-lg font-semibold">PayPal</div>
          <form className="space-y-4" onSubmit={paypal.handleSubmit(savePaypal)}>
            <FieldRow label="Environment"><Select {...paypal.register('environment')}><option value="SANDBOX">SANDBOX</option><option value="LIVE">LIVE</option></Select></FieldRow>
            <FieldRow label="Client ID"><Input {...paypal.register('clientId')} /></FieldRow>
            <FieldRow label="Client secret"><Input type="password" {...paypal.register('clientSecret')} /></FieldRow>
            <FieldRow label="Webhook ID"><Input {...paypal.register('webhookId')} /></FieldRow>
            <Button type="submit">Save PayPal</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
