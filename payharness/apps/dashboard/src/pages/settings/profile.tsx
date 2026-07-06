import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
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

export default function ProfileSettingsPage() {
  const [status, setStatus] = useState('');
  const { register, handleSubmit, reset } = useForm<MerchantProfile>({ defaultValues: emptyProfile });

  useEffect(() => {
    api.get<MerchantProfile>('/merchant/profile').then(({ data }) => reset(normalizeProfile(data)));
  }, [reset]);

  const onSubmit = async (values: MerchantProfile) => {
    setStatus('Saving...');
    await api.patch('/merchant/profile', values);
    setStatus('Saved');
  };

  return (
    <div className="space-y-6">
      <SectionTitle title="Merchant profile" description="Business and support information." />
      <Panel className="p-6">
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
            <Button type="submit">Save profile</Button>
            <div className="text-sm text-muted">{status}</div>
          </div>
        </form>
      </Panel>
    </div>
  );
}
