import { useEffect, useState } from 'react';
import { useRouter } from 'next/compat/router';
import { clearSession, getSession, getToken } from '@/lib/auth';

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
    return <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">Loading...</div>;
  }
  return <>{children}</>;
}

export function logout(router: ReturnType<typeof useRouter>) {
  clearSession();
  router?.push('/login');
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
    return <div className="flex min-h-screen items-center justify-center bg-bg text-sm text-muted">Loading...</div>;
  }
  return <>{children}</>;
}

export function platformLogout(router: ReturnType<typeof useRouter>) {
  clearSession();
  router?.push('/platform/login');
}
