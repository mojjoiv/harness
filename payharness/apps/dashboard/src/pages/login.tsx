import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ApiError, api, buildApiUrl } from '@/lib/api';
import { getToken, setSession, type AuthSession } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow } from '@/components/blocks';

type LoginState = {
  email: string;
  password: string;
};

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} (status: ${error.status}, code: ${error.code})`;
  }

  return error instanceof Error ? error.message : 'Login failed. Please check your details and try again.';
}

function isAuthSession(data: unknown): data is AuthSession {
  return Boolean(data) && typeof data === 'object' && typeof (data as AuthSession).accessToken === 'string';
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginState>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginState, string>>>({});
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

  const validate = (values: LoginState) => {
    const nextErrors: Partial<Record<keyof LoginState, string>> = {};
    if (!values.email) nextErrors.email = 'Email is required';
    if (!values.password) nextErrors.password = 'Password is required';
    return nextErrors;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = {
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
    const requestUrl = buildApiUrl('/auth/login');
    setLastRequestUrl(requestUrl);
    try {
      const { data } = await api.post<unknown>('/auth/login', values);
      if (!isAuthSession(data)) {
        throw new ApiError('Login response did not include accessToken', 'INVALID_AUTH_RESPONSE', 500);
      }
      setSession(data);
      await router.replace('/dashboard');
    } catch (err) {
      const message = formatError(err);
      if (process.env.NODE_ENV === 'development') {
        console.error('Login request failed', err);
      }
      setError(message);
      setLastError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="w-full max-w-md p-6">
        <SectionTitle title="Sign in" description="Access your merchant dashboard." />
        <form className="space-y-4" onSubmit={onSubmit}>
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
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.currentTarget.value }))}
            />
            {errors.password ? <div className="text-xs text-rose-700">{errors.password}</div> : null}
          </FieldRow>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
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
          No account yet? <Link className="text-brand" href="/register">Register</Link>
        </div>
      </Panel>
    </div>
  );
}
