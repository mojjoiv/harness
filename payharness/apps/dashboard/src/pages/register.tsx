import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ApiError, api, buildApiUrl } from '@/lib/api';
import { getToken, setSession, type AuthSession } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';

type RegisterState = {
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
  const [form, setForm] = useState<RegisterState>({
    name: '',
    merchantName: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterState, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequestUrl, setLastRequestUrl] = useState('');
  const [lastError, setLastError] = useState('');
  const showDebug = process.env.NODE_ENV !== 'production' || router.query.debug === '1';

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const validate = (values: RegisterState) => {
    const nextErrors: Partial<Record<keyof RegisterState, string>> = {};
    if (!values.name) nextErrors.name = 'Name is required';
    if (!values.merchantName) nextErrors.merchantName = 'Merchant name is required';
    if (!values.email) nextErrors.email = 'Email is required';
    if (!values.password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
      name: form.name.trim(),
      merchantName: form.merchantName.trim(),
      email: form.email.trim(),
      password: form.password.trim(),
    };
    const nextErrors = validate(values);
    setErrors(nextErrors);
    setError('');
    setLastError('');
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setLoading(true);
    const requestUrl = buildApiUrl('/auth/register');
    setLastRequestUrl(requestUrl);
    try {
      const { data } = await api.post<unknown>('/auth/register', values);
      if (!isAuthSession(data)) {
        throw new ApiError('Register response did not include accessToken', 'INVALID_AUTH_RESPONSE', 500);
      }
      setSession(data);
      await router.replace('/dashboard');
    } catch (err) {
      const message = formatError(err);
      if (process.env.NODE_ENV === 'development') {
        console.error('Registration request failed', err);
      }
      setError(message);
      setLastError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="w-full max-w-2xl p-6">
        <SectionTitle title="Create merchant account" description="Start with a new PayHarness workspace." />
        <form className="space-y-4" onSubmit={onSubmit}>
          <FormGrid>
            <FieldRow label="Name">
              <Input
                autoComplete="name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.currentTarget.value }))}
              />
              {errors.name ? <div className="text-xs text-rose-700">{errors.name}</div> : null}
            </FieldRow>
            <FieldRow label="Merchant name">
              <Input
                value={form.merchantName}
                onChange={(event) => setForm((current) => ({ ...current, merchantName: event.currentTarget.value }))}
              />
              {errors.merchantName ? <div className="text-xs text-rose-700">{errors.merchantName}</div> : null}
            </FieldRow>
          </FormGrid>
          <FormGrid>
            <FieldRow label="Email">
              <Input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))}
              />
              {errors.email ? <div className="text-xs text-rose-700">{errors.email}</div> : null}
            </FieldRow>
            <FieldRow label="Password">
              <Input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.currentTarget.value }))}
              />
              {errors.password ? <div className="text-xs text-rose-700">{errors.password}</div> : null}
            </FieldRow>
          </FormGrid>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </Button>
          {showDebug ? (
            <div className="space-y-1 text-xs text-muted">
              <div>API: {process.env.NEXT_PUBLIC_API_URL || 'not configured'}</div>
              <div>Last request: {lastRequestUrl || 'none'}</div>
              <div>Last error: {lastError || 'none'}</div>
            </div>
          ) : null}
        </form>
        <div className="mt-4 text-sm text-muted">
          Already have an account? <Link className="text-brand" href="/login">Sign in</Link>
        </div>
      </Panel>
    </div>
  );
}
