import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { navigateTopLevel } from '../../lib/navigation';

type Result = 'success' | 'failed' | 'cancelled';
type StatusResponse = { status: string; successUrl: string; cancelUrl: string };

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function getStatus(sessionId: string): Promise<StatusResponse> {
  const response = await fetch(`${API_URL}/public/checkout-sessions/${sessionId}/status`, {
    headers: { 'Content-Type': 'application/json' },
  });
  const payload = (await response.json()) as { success?: boolean; data?: StatusResponse; message?: string };
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.message || 'Unable to verify payment status');
  }
  return payload.data;
}

export default function CheckoutResultPage() {
  const router = useRouter();
  const result = router.query.result as Result | undefined;
  const sessionId = typeof router.query.sessionId === 'string' ? router.query.sessionId : '';
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const copy = useMemo(() => {
    if (result === 'success') return { title: 'Payment successful', description: 'Your payment has been confirmed.', action: 'Continue to merchant', tone: 'emerald' };
    if (result === 'cancelled') return { title: 'Payment cancelled', description: 'No payment was completed. You can return to the merchant and try again.', action: 'Return to merchant', tone: 'amber' };
    return { title: 'Payment failed', description: 'The payment was not completed. You can return to the merchant and try again.', action: 'Return to merchant', tone: 'rose' };
  }, [result]);

  useEffect(() => {
    if (!sessionId || !result) return;
    let cancelled = false;
    const verify = async () => {
      try {
        const data = await getStatus(sessionId);
        if (cancelled) return;
        setStatus(data);
        if (result === 'success' && data.status !== 'SUCCEEDED') {
          setError('This payment is not confirmed as successful yet. Please return to checkout to check again.');
        } else if (result === 'failed' && !['FAILED', 'CANCELED'].includes(data.status)) {
          setError('The payment status is still being confirmed. Please return to checkout to check again.');
        } else if (result === 'cancelled' && data.status !== 'CANCELED') {
          setError('The payment cancellation has not been confirmed yet. Please return to checkout to check again.');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to verify payment status');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void verify();
    return () => { cancelled = true; };
  }, [result, sessionId]);

  const continueToMerchant = () => {
    if (!status) return;
    navigateTopLevel(result === 'success' ? status.successUrl : status.cancelUrl);
  };

  if (!['success', 'failed', 'cancelled'].includes(result || '') || !sessionId) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><h1 className="text-xl font-semibold text-slate-950">Checkout result unavailable</h1><p className="mt-2 text-sm text-slate-500">The payment session could not be identified.</p></div></main>;
  }

  const iconClass = copy.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : copy.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-bold ${iconClass}`}>
          {result === 'success' ? '✓' : result === 'cancelled' ? '×' : '!'}
        </div>
        <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-950">{copy.title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{loading ? 'Verifying your payment…' : error || copy.description}</p>
        {!loading && status && !error ? <button type="button" onClick={continueToMerchant} className="mt-7 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">{copy.action}</button> : null}
        {!loading && error ? <button type="button" onClick={() => navigateTopLevel(`/pay/${encodeURIComponent(sessionId)}`)} className="mt-7 w-full rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Back to checkout</button> : null}
        <p className="mt-6 text-xs text-slate-400">Secure payment powered by PayHarness</p>
      </section>
    </main>
  );
}
