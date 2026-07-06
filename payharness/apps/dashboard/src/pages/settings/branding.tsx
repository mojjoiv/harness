import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
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

export default function BrandingSettingsPage() {
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset, watch } = useForm<MerchantBranding>({ defaultValues: emptyBranding });
  const preview = watch();

  useEffect(() => {
    api.get<MerchantBranding>('/merchant/branding').then(({ data }) => reset(normalizeBranding(data)));
  }, [reset]);

  const onSubmit = async (values: MerchantBranding) => {
    setStatus('Saving...');
    await api.patch('/merchant/branding', values);
    setStatus('Saved');
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Branding" description="Control the look of hosted checkout and receipts." />
      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel className="p-6">
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <FormGrid>
              <FieldRow label="Logo URL"><Input {...register('logoUrl')} /></FieldRow>
              <FieldRow label="Favicon URL"><Input {...register('faviconUrl')} /></FieldRow>
              <FieldRow label="Primary color"><Input type="color" {...register('primaryColor')} /></FieldRow>
              <FieldRow label="Secondary color"><Input type="color" {...register('secondaryColor')} /></FieldRow>
              <FieldRow label="Button color"><Input type="color" {...register('buttonColor')} /></FieldRow>
              <FieldRow label="Merchant name"><Input {...register('merchantName')} /></FieldRow>
            </FormGrid>
            <FieldRow label="Success page message"><Input {...register('successPageMessage')} /></FieldRow>
            <FieldRow label="Cancel page message"><Input {...register('cancelPageMessage')} /></FieldRow>
            <FieldRow label="Receipt footer"><Input {...register('receiptFooter')} /></FieldRow>
            <div className="flex items-center gap-3">
              <Button type="submit">Save branding</Button>
              <div className="text-sm text-muted">{status}</div>
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
