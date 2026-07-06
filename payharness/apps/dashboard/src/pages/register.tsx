import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ApiError, api } from '@/lib/api';
import { getToken, setSession, type AuthSession } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

type RegisterForm = {
  name: string;
  merchantName: string;
  email: string;
  password: string;
};

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} (status: ${error.status}, code: ${error.code})`;
  }

  return error instanceof Error ? error.message : 'Registration failed. Please check your details and try again.';
}

function isAuthSession(data: unknown): data is AuthSession {
  return Boolean(data) && typeof data === 'object' && typeof (data as AuthSession).accessToken === 'string';
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>();
  const showDebug = process.env.NODE_ENV !== 'production' || router.query.debug === '1';

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const onSubmit = async (values: RegisterForm) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<unknown>('/auth/register', values);
      if (!isAuthSession(data)) {
        throw new ApiError('Register response did not include accessToken', 'INVALID_AUTH_RESPONSE', 500);
      }
      setSession(data);
      await router.replace('/dashboard');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration request failed', err);
      }
      setError(formatError(err));
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
              <Input autoComplete="name" {...register('name', { required: 'Name is required' })} />
              {errors.name ? <div className="text-xs text-rose-700">{errors.name.message}</div> : null}
            </FieldRow>
            <FieldRow label="Merchant name">
              <Input {...register('merchantName', { required: 'Merchant name is required' })} />
              {errors.merchantName ? <div className="text-xs text-rose-700">{errors.merchantName.message}</div> : null}
            </FieldRow>
          </FormGrid>
          <FormGrid>
            <FieldRow label="Email">
              <Input type="email" autoComplete="email" {...register('email', { required: 'Email is required' })} />
              {errors.email ? <div className="text-xs text-rose-700">{errors.email.message}</div> : null}
            </FieldRow>
            <FieldRow label="Password">
              <Input
                type="password"
                autoComplete="new-password"
                {...register('password', { required: 'Password is required' })}
              />
              {errors.password ? <div className="text-xs text-rose-700">{errors.password.message}</div> : null}
            </FieldRow>
          </FormGrid>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </Button>
          {showDebug ? (
            <div className="text-xs text-muted">API: {process.env.NEXT_PUBLIC_API_URL || 'not configured'}</div>
          ) : null}
        </form>
        <div className="mt-4 text-sm text-muted">
          Already have an account? <Link className="text-brand" href="/login">Sign in</Link>
        </div>
      </Panel>
    </div>
  );
}
