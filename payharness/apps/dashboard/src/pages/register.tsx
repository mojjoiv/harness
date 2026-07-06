import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '@/lib/api';
import { getToken, setSession } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

type RegisterForm = {
  name: string;
  merchantName: string;
  email: string;
  password: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<RegisterForm>();

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const onSubmit = async (values: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<any>('/auth/register', values);
      setSession(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="w-full max-w-2xl p-6">
        <SectionTitle title="Create merchant account" description="Start with a new PayHarness workspace." />
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormGrid>
            <FieldRow label="Name">
              <Input autoComplete="name" {...register('name', { required: true })} />
            </FieldRow>
            <FieldRow label="Merchant name">
              <Input {...register('merchantName', { required: true })} />
            </FieldRow>
          </FormGrid>
          <FormGrid>
            <FieldRow label="Email">
              <Input type="email" autoComplete="email" {...register('email', { required: true })} />
            </FieldRow>
            <FieldRow label="Password">
              <Input type="password" autoComplete="new-password" {...register('password', { required: true })} />
            </FieldRow>
          </FormGrid>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </Button>
        </form>
        <div className="mt-4 text-sm text-muted">
          Already have an account? <Link className="text-brand" href="/login">Sign in</Link>
        </div>
      </Panel>
    </div>
  );
}
