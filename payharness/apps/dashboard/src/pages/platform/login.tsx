import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { ApiError, api, buildApiUrl } from '@/lib/api';
import { getSession, getToken, setSession, type AuthSession } from '@/lib/auth';
import { FieldRow } from '@/components/blocks';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';

type LoginState = {
  email: string;
  password: string;
};

function isPlatformSession(data: unknown): data is AuthSession {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    typeof (data as AuthSession).accessToken === 'string' &&
    (data as AuthSession).type === 'platform'
  );
}

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    return `${error.message} (status: ${error.status}, code: ${error.code})`;
  }

  return error instanceof Error ? error.message : 'Login failed. Please check your details and try again.';
}

export default function PlatformLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginState>({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequestUrl, setLastRequestUrl] = useState('');
  const showDebug = process.env.NODE_ENV !== 'production' || router.query.debug === '1';

  useEffect(() => {
    if (getToken() && getSession()?.type === 'platform') {
      router.replace('/platform');
    }
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const requestUrl = buildApiUrl('/platform/auth/login');
    setLastRequestUrl(requestUrl);

    try {
      const { data } = await api.post<unknown>('/platform/auth/login', {
        email: form.email.trim(),
        password: form.password,
      });
      if (!isPlatformSession(data)) {
        throw new ApiError('Login response did not include a platform token', 'INVALID_AUTH_RESPONSE', 500);
      }
      setSession(data);
      await router.replace('/platform');
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="w-full max-w-md p-6">
        <SectionTitle title="Platform sign in" description="Access the SaaS administration console." />
        <form className="space-y-4" onSubmit={onSubmit}>
          <FieldRow label="Email">
            <Input type="email" autoComplete="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.currentTarget.value }))} />
          </FieldRow>
          <FieldRow label="Password">
            <Input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.currentTarget.value }))} />
          </FieldRow>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
          {showDebug ? (
            <div className="space-y-1 text-xs text-muted">
              <div>API: {process.env.NEXT_PUBLIC_API_URL || 'not configured'}</div>
              <div>Last request: {lastRequestUrl || 'none'}</div>
            </div>
          ) : null}
        </form>
      </Panel>
    </div>
  );
}
