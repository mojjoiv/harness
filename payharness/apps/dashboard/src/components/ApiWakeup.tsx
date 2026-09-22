import { useEffect } from 'react';
import { buildApiUrl } from '@/lib/api';

export function ApiWakeup() {
  useEffect(() => {
    let cancelled = false;

    const wakeApi = async () => {
      try {
        const response = await fetch(buildApiUrl('/health'), {
          method: 'GET',
          cache: 'no-store',
        });

        if (!cancelled && response.ok) {
          window.dispatchEvent(new Event('payharness:api-ready'));
        }
      } catch {
        // Render may still be waking. Normal API requests will retry/fail
        // according to their existing error handling.
      }
    };

    void wakeApi();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
