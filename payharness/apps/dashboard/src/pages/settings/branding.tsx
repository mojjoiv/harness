import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '@/lib/api';
import { MerchantBranding } from '@/lib/types';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

const emptyBranding: MerchantBranding = {
  merchantName: '',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  buttonColor: '#1d4ed8',
  successPageMessage: '',
  cancelPageMessage: '',
  receiptFooter: '',
};

function normalizeBranding(branding: MerchantBranding): MerchantBranding {
  return {
    ...branding,
    merchantName: branding.merchantName || '',
    logoUrl: branding.logoUrl || '',
    faviconUrl: branding.faviconUrl || '',
    primaryColor: branding.primaryColor || '#1d4ed8',
    secondaryColor: branding.secondaryColor || '#0f172a',
    buttonColor: branding.buttonColor || '#1d4ed8',
    successPageMessage: branding.successPageMessage || '',
    cancelPageMessage: branding.cancelPageMessage || '',
    receiptFooter: branding.receiptFooter || '',
  };
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function BrandingSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset, watch, formState } = useForm<MerchantBranding>({
    defaultValues: emptyBranding,
  });
  const preview = watch();

  useEffect(() => {
    let active = true;

    const loadBranding = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await api.get<MerchantBranding>('/merchant/branding');
        if (active) reset(normalizeBranding(data));
      } catch (error) {
        if (active) setLoadError(formatError(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadBranding();
    return () => {
      active = false;
    };
  }, [reset]);

  const onSubmit = async (values: MerchantBranding) => {
    setSaveError('');
    setStatus('Saving...');
    const brandingPayload = {
      logoUrl: values.logoUrl,
      faviconUrl: values.faviconUrl,
      primaryColor: values.primaryColor,
      secondaryColor: values.secondaryColor,
      buttonColor: values.buttonColor,
      successPageMessage: values.successPageMessage,
      cancelPageMessage: values.cancelPageMessage,
      receiptFooter: values.receiptFooter,
    };
    try {
      await api.patch('/merchant/branding', brandingPayload);
      setStatus('Saved');
    } catch (error) {
      setStatus('');
      setSaveError(formatError(error));
    }
  };

  const isSubmitting = formState.isSubmitting;

  return (
    <div className="space-y-6">
      <SectionTitle title="Branding" description="Control the look of hosted checkout and receipts." />
      {loading && (
        <Panel className="p-4 text-sm text-muted" role="status">
          Loading branding settings...
        </Panel>
      )}
      {loadError && (
        <Panel className="border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {loadError}
        </Panel>
      )}
      {saveError && (
        <Panel className="border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {saveError}
        </Panel>
      )}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <FormGrid>
              <FieldRow label="Logo URL"><Input {...register('logoUrl')} disabled={loading || isSubmitting} /></FieldRow>
              <FieldRow label="Favicon URL"><Input {...register('faviconUrl')} disabled={loading || isSubmitting} /></FieldRow>
              <FieldRow label="Primary color"><Input type="color" {...register('primaryColor')} disabled={loading || isSubmitting} /></FieldRow>
              <FieldRow label="Secondary color"><Input type="color" {...register('secondaryColor')} disabled={loading || isSubmitting} /></FieldRow>
              <FieldRow label="Button color"><Input type="color" {...register('buttonColor')} disabled={loading || isSubmitting} /></FieldRow>
              <FieldRow label="Merchant name"><Input {...register('merchantName')} disabled={loading || isSubmitting} /></FieldRow>
            </FormGrid>
            <FieldRow label="Success page message"><Input {...register('successPageMessage')} disabled={loading || isSubmitting} /></FieldRow>
            <FieldRow label="Cancel page message"><Input {...register('cancelPageMessage')} disabled={loading || isSubmitting} /></FieldRow>
            <FieldRow label="Receipt footer"><Input {...register('receiptFooter')} disabled={loading || isSubmitting} /></FieldRow>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={loading || isSubmitting}>{isSubmitting ? 'Saving...' : 'Save branding'}</Button>
              <div className="text-sm text-muted" role="status">{status}</div>
            </div>
          </form>
        </Panel>
        <Panel className="p-6">
          <div className="text-sm font-medium text-ink">Live preview</div>
          <div className="mt-4 rounded-2xl p-5 text-white shadow-soft" style={{ background: preview.primaryColor || '#1d4ed8' }}>
            <div className="text-xs uppercase tracking-wide text-white/75">PayHarness</div>
            <div className="mt-3 h-12 w-12 rounded-xl bg-white/20" />
            <div className="mt-4 text-xl font-semibold">{preview.merchantName || 'Merchant Name'}</div>
            <div className="mt-2 text-sm text-white/80">{preview.successPageMessage || 'Success message preview'}</div>
            <button className="mt-4 rounded-xl px-4 py-2 text-sm font-medium" style={{ background: preview.buttonColor || '#ffffff', color: '#0f172a' }}>
              Pay now
            </button>
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-panelAlt p-4 text-sm text-muted">
            Branding values here will later power hosted checkout.
          </div>
        </Panel>
      </div>
    </div>
  );
}
