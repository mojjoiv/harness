import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api, ApiError } from '@/lib/api';
import { MerchantProfile } from '@/lib/types';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

const emptyProfile: MerchantProfile = {
  businessName: '',
  legalName: '',
  registrationNumber: '',
  taxPin: '',
  country: '',
  currency: '',
  timezone: '',
  supportEmail: '',
  supportPhone: '',
  website: '',
  logoUrl: '',
  primaryBrandColor: '',
  secondaryBrandColor: '',
};

function normalizeProfile(profile: MerchantProfile): MerchantProfile {
  return {
    ...profile,
    businessName: profile.businessName || '',
    legalName: profile.legalName || '',
    registrationNumber: profile.registrationNumber || '',
    taxPin: profile.taxPin || '',
    country: profile.country || '',
    currency: profile.currency || '',
    timezone: profile.timezone || '',
    supportEmail: profile.supportEmail || '',
    supportPhone: profile.supportPhone || '',
    website: profile.website || '',
    logoUrl: profile.logoUrl || '',
    primaryBrandColor: profile.primaryBrandColor || '',
    secondaryBrandColor: profile.secondaryBrandColor || '',
  };
}

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function ProfileSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset, formState } = useForm<MerchantProfile>({
    defaultValues: emptyProfile,
  });

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const { data } = await api.get<MerchantProfile>('/merchant/profile');
        if (active) reset(normalizeProfile(data));
      } catch (error) {
        if (active) setLoadError(formatError(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadProfile();

    return () => {
      active = false;
    };
  }, [reset]);

  const onSubmit = async (values: MerchantProfile) => {
    setStatus('');
    setSaveError('');

    const profilePayload = {
      businessName: values.businessName,
      legalName: values.legalName,
      registrationNumber: values.registrationNumber,
      taxPin: values.taxPin,
      country: values.country,
      currency: values.currency,
      timezone: values.timezone,
      supportEmail: values.supportEmail,
      supportPhone: values.supportPhone,
      website: values.website,
      logoUrl: values.logoUrl,
      primaryBrandColor: values.primaryBrandColor,
      secondaryBrandColor: values.secondaryBrandColor,
    };

    try {
      await api.patch('/merchant/profile', profilePayload);
      reset(values);
      setStatus('Profile saved successfully.');
    } catch (error) {
      setSaveError(formatError(error));
    }
  };

  const isSubmitting = formState.isSubmitting;

  return (
    <div className="space-y-6">
      <SectionTitle title="Merchant profile" description="Business and support information." />
      {loadError ? (
        <Panel className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {loadError}
        </Panel>
      ) : null}
      {saveError ? (
        <Panel className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {saveError}
        </Panel>
      ) : null}
      {status ? (
        <Panel className="border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          {status}
        </Panel>
      ) : null}
      <Panel className="p-6">
        {loading ? (
          <div className="text-sm text-muted">Loading merchant profile…</div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <FormGrid>
              <FieldRow label="Business name"><Input {...register('businessName')} /></FieldRow>
              <FieldRow label="Legal name"><Input {...register('legalName')} /></FieldRow>
              <FieldRow label="Registration number"><Input {...register('registrationNumber')} /></FieldRow>
              <FieldRow label="Tax PIN"><Input {...register('taxPin')} /></FieldRow>
              <FieldRow label="Country"><Input {...register('country')} /></FieldRow>
              <FieldRow label="Currency"><Input {...register('currency')} /></FieldRow>
              <FieldRow label="Timezone"><Input {...register('timezone')} /></FieldRow>
              <FieldRow label="Support email"><Input type="email" {...register('supportEmail')} /></FieldRow>
              <FieldRow label="Support phone"><Input {...register('supportPhone')} /></FieldRow>
              <FieldRow label="Website"><Input {...register('website')} /></FieldRow>
              <FieldRow label="Logo URL"><Input {...register('logoUrl')} /></FieldRow>
              <FieldRow label="Primary brand color"><Input type="color" {...register('primaryBrandColor')} /></FieldRow>
              <FieldRow label="Secondary brand color"><Input type="color" {...register('secondaryBrandColor')} /></FieldRow>
            </FormGrid>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </form>
        )}
      </Panel>
    </div>
  );
}
