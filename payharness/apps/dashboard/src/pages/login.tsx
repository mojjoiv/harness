import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { api } from '@/lib/api';
import { getToken, setSession } from '@/lib/auth';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow } from '@/components/blocks';

type LoginForm = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit } = useForm<LoginForm>();

  useEffect(() => {
    if (getToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const onSubmit = async (values: LoginForm) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post<any>('/auth/login', values);
      setSession(data);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="w-full max-w-md p-6">
        <SectionTitle title="Sign in" description="Access your merchant dashboard." />
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FieldRow label="Email">
            <Input type="email" autoComplete="email" {...register('email', { required: true })} />
          </FieldRow>
          <FieldRow label="Password">
            <Input type="password" autoComplete="current-password" {...register('password', { required: true })} />
          </FieldRow>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
        <div className="mt-4 text-sm text-muted">
          No account yet? <Link className="text-brand" href="/register">Register</Link>
        </div>
      </Panel>
    </div>
  );
}
