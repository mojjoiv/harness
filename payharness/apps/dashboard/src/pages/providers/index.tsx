import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '@/lib/api';
import { ProviderCredentialRecord, ProviderVerificationLogRecord } from '@/lib/types';
import { Badge, Button, CopyButton, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, FormGrid, SimpleTable } from '@/components/blocks';
import { dateTime } from '@/lib/format';
import { ProviderDetailsModal } from '@/components/ProviderDetailsModal';

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

const HEALTH_META: Record<string, { emoji: string; label: string; tone: 'neutral' | 'green' | 'red' | 'blue' }> = {
  VERIFIED: { emoji: '🟢', label: 'Healthy', tone: 'green' },
  PARTIALLY_VERIFIED: { emoji: '🟡', label: 'Partially Verified', tone: 'neutral' },
  PENDING: { emoji: '🟡', label: 'Pending Verification', tone: 'neutral' },
  INVALID: { emoji: '🔴', label: 'Invalid Credentials', tone: 'red' },
  DISABLED: { emoji: '⚫', label: 'Disabled', tone: 'neutral' },
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function StatusBadge({ healthStatus }: { healthStatus: string }) {
  const health = HEALTH_META[healthStatus] || HEALTH_META.PENDING;
  return <Badge tone={health.tone}>{health.emoji} {health.label}</Badge>;
}

export default function ProvidersPage() {
  const [credentials, setCredentials] = useState<ProviderCredentialRecord[]>([]);
  const [message, setMessage] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedCredential, setSelectedCredential] = useState<ProviderCredentialRecord | null>(null);
  const [history, setHistory] = useState<ProviderVerificationLogRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [lastSaved, setLastSaved] = useState<{ provider: string; payload: unknown } | null>(null);
  const mpesa = useForm<MpesaForm>({ defaultValues: { environment: 'SANDBOX', businessType: 'PAYBILL', shortcode: '', accountReference: '', consumerKey: '', consumerSecret: '', passkey: '' } });
  const stripe = useForm<StripeForm>({ defaultValues: { environment: 'SANDBOX', publishableKey: '', secretKey: '', webhookSecret: '' } });
  const paypal = useForm<PaypalForm>({ defaultValues: { environment: 'SANDBOX', clientId: '', clientSecret: '', webhookId: '' } });

  const refresh = () => {
    api
      .get<ProviderCredentialRecord[]>('/provider-credentials')
      .then(({ data }) => {
        setCredentials(data);
        setSelectedCredential((current) => current ? data.find((item) => item.id === current.id) || current : null);
      })
      .catch((err) => setCredentialError(err instanceof ApiError ? err.message : 'Failed to load connections.'));
  };

  useEffect(() => {
    refresh();
  }, []);

  const verify = async (id: string) => {
    setBusyId(id);
    setCredentialError('');
    try {
      const { data } = await api.post<{ verified: boolean; message: string }>(`/provider-credentials/${id}/verify`);
      setMessage(data.verified ? 'Credentials verified successfully' : `Verification failed: ${data.message}`);
      refresh();
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : 'Verification failed.');
    } finally {
      setBusyId(null);
    }
  };

  const disconnect = async (id: string) => {
    setBusyId(id);
    setCredentialError('');
    try {
      await api.patch(`/provider-credentials/${id}/disconnect`);
      setMessage('Provider disconnected.');
      setSelectedCredential(null);
      refresh();
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : 'Failed to disconnect.');
    } finally {
      setBusyId(null);
    }
  };

  const setDefault = async (id: string) => {
    setBusyId(id);
    setCredentialError('');
    try {
      await api.patch(`/provider-credentials/${id}/default`);
      setMessage('Default provider updated.');
      refresh();
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : 'Failed to set default.');
    } finally {
      setBusyId(null);
    }
  };

  const openProviderDetails = async (credential: ProviderCredentialRecord) => {
    setSelectedCredential(credential);
    setHistory([]);
    setHistoryLoading(true);
    setCredentialError('');
    try {
      const { data } = await api.get<ProviderVerificationLogRecord[]>(
        `/provider-credentials/${credential.id}/verification-history`,
      );
      setHistory(data);
    } catch (err) {
      setCredentialError(err instanceof ApiError ? err.message : 'Failed to load verification history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const closeProviderDetails = () => {
    setSelectedCredential(null);
    setHistory([]);
  };

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

  const credentialRows = credentials.map((credential) => [
    credential.provider === 'MPESA' ? 'M-Pesa' : credential.provider,
    credential.environment,
    <StatusBadge key={`${credential.id}-health`} healthStatus={credential.healthStatus} />,
    credential.isDefault ? <Badge key={`${credential.id}-default`} tone="blue">Default</Badge> : '—',
    credential.updatedAt ? dateTime(credential.updatedAt) : 'Never',
    <button
      key={`${credential.id}-view`}
      type="button"
      aria-label={`View ${credential.provider === 'MPESA' ? 'M-Pesa' : credential.provider} details`}
      title="View provider details"
      onClick={() => openProviderDetails(credential)}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-muted transition hover:bg-panelAlt hover:text-ink"
    >
      <EyeIcon />
    </button>,
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Providers" description="View connection status and manage your payment provider configurations." />
      {credentialError ? (
        <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{credentialError}</Panel>
      ) : null}

      <SimpleTable
        headers={['Provider', 'Environment', 'Health', 'Default', 'Last updated', 'View']}
        rows={credentialRows}
        emptyText="No provider connections yet."
      />

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

      {selectedCredential ? (
        <ProviderDetailsModal
          credential={selectedCredential}
          history={history}
          historyLoading={historyLoading}
          onClose={closeProviderDetails}
          onVerify={() => verify(selectedCredential.id)}
          onSetDefault={() => setDefault(selectedCredential.id)}
          onDisconnect={() => disconnect(selectedCredential.id)}
          busy={busyId === selectedCredential.id}
        />
      ) : null}
    </div>
  );
}
