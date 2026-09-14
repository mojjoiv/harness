import { useEffect, useState } from 'react';
import { useRouter } from 'next/compat/router';
import { clearSession, getSession, getToken } from '@/lib/auth';
import { Panel } from './ui';

function AuthLoading({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 text-sm text-muted">
      <Panel className="w-full max-w-sm p-6 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand" />
        <div className="mt-4 font-medium text-ink">{label}</div>
        <div className="mt-1 text-xs text-muted">Checking your session…</div>
      </Panel>
    </div>
  );
}

export function AuthGate({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const session = getSession();
    if (!token || session?.type !== 'merchant') {
      clearSession();
      router?.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <AuthLoading label="Loading PayHarness" />;
  }
  return <>{children}</>;
}

export function logout(router: ReturnType<typeof useRouter>) {
  clearSession();
  router?.push('/');
}

export function PlatformAuthGate({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    const session = getSession();
    if (!token || session?.type !== 'platform') {
      clearSession();
      router?.replace('/platform/login');
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return <AuthLoading label="Loading platform console" />;
  }
  return <>{children}</>;
}

export function platformLogout(router: ReturnType<typeof useRouter>) {
  clearSession();
  router?.push('/platform/login');
}
