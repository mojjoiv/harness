import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ApiError, api, buildApiUrl } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { FieldRow, FormGrid } from '@/components/blocks';
import { COUNTRY_CURRENCIES } from '@/lib/countries';

type RegisterState = {
  name: string;
  merchantName: string;
  email: string;
  password: string;
  countryCode: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  MPESA: 'M-Pesa',
  STRIPE: 'Stripe',
  PAYPAL: 'PayPal',
};

function formatError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 400 && /already registered/i.test(error.message)) {
      return 'An account with this email already exists. Try signing in instead.';
    }
    return error.message;
  }

  return error instanceof Error ? error.message : 'Registration failed. Please check your details and try again.';
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterState>({
    name: '',
    merchantName: '',
    email: '',
    password: '',
    countryCode: 'US',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterState, string>>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastRequestUrl, setLastRequestUrl] = useState('');
  const [lastError, setLastError] = useState('');
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [submitted, setSubmitted] = useState<{ merchantName: string; email: string } | null>(null);
  const showDebug = process.env.NODE_ENV !== 'production' || router.query.debug === '1';

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    setLoadingProviders(true);
    api
      .get<string[]>(`/provider-availability?country=${form.countryCode}`)
      .then(({ data }) => {
        if (!cancelled) setAvailableProviders(data);
      })
      .catch(() => {
        if (!cancelled) setAvailableProviders([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProviders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.countryCode]);

  const validate = (values: RegisterState) => {
    const nextErrors: Partial<Record<keyof RegisterState, string>> = {};
    if (!values.name) nextErrors.name = 'Name is required';
    if (!values.merchantName) nextErrors.merchantName = 'Merchant name is required';
    if (!values.email) nextErrors.email = 'Email is required';
    if (!values.password) nextErrors.password = 'Password is required';
    if (!values.countryCode) nextErrors.countryCode = 'Country is required';
    return nextErrors;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values: RegisterState = {
      name: form.name.trim(),
      merchantName: form.merchantName.trim(),
      email: form.email.trim(),
      password: form.password,
      countryCode: form.countryCode,
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
      await api.post('/auth/register', {
        name: values.name,
        merchantName: values.merchantName,
        email: values.email,
        password: values.password,
        country: values.countryCode,
      });
      setSubmitted({ merchantName: values.merchantName, email: values.email });
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
        {submitted ? (
          <>
            <SectionTitle
              title="Registration submitted"
              description="Thanks for signing up -- here's what happens next."
            />
            <div className="rounded-xl bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
              <p>
                <strong>{submitted.merchantName}</strong> has been registered and is now awaiting approval by the
                Platform Administrator.
              </p>
              <p className="mt-2">
                We'll email <strong>{submitted.email}</strong> as soon as a decision is made. You can try signing
                in once your organization has been approved.
              </p>
            </div>
            <div className="mt-4 text-sm text-muted">
              <Link className="text-brand" href="/login">
                Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <>
            <SectionTitle title="Create merchant account" description="Start with a new PayHarness workspace." />
            <form className="space-y-4" onSubmit={onSubmit}>
              <FormGrid>
                <FieldRow label="Name">
                  <Input
                    autoComplete="name"
                    value={form.name}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({ ...current, name: value }));
                    }}
                  />
                  {errors.name ? <div className="text-xs text-rose-700">{errors.name}</div> : null}
                </FieldRow>
                <FieldRow label="Merchant name">
                  <Input
                    value={form.merchantName}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({ ...current, merchantName: value }));
                    }}
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
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({ ...current, email: value }));
                    }}
                  />
                  {errors.email ? <div className="text-xs text-rose-700">{errors.email}</div> : null}
                </FieldRow>
                <FieldRow label="Password">
                  <Input
                    type="password"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(event) => {
                      const value = event.currentTarget.value;
                      setForm((current) => ({ ...current, password: value }));
                    }}
                  />
                  {errors.password ? <div className="text-xs text-rose-700">{errors.password}</div> : null}
                </FieldRow>
              </FormGrid>
              <FieldRow label="Country" hint="Determines which payment methods you'll be able to use">
                <Select
                  value={form.countryCode}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, countryCode: value }));
                  }}
                >
                  {COUNTRY_CURRENCIES.map((c) => (
                    <option key={c.countryCode} value={c.countryCode}>
                      {c.country}
                    </option>
                  ))}
                </Select>
              </FieldRow>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-muted">
                {loadingProviders
                  ? 'Checking available payment methods…'
                  : availableProviders.length > 0
                    ? `Available payment methods in this country: ${availableProviders
                        .map((p) => PROVIDER_LABELS[p] || p)
                        .join(', ')}`
                    : 'No payment methods are currently available in this country yet.'}
              </div>
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
          </>
        )}
      </Panel>
    </div>
  );
}
