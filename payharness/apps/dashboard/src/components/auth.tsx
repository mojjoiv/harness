import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { clearSession, getToken } from '@/lib/auth';

export function AuthGate({ children }: React.PropsWithChildren) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace('/login');
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
  router.push('/login');
}
