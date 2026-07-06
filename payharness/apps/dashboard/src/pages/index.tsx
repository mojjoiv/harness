import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { getToken } from '@/lib/auth';

export default function IndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getToken() ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
