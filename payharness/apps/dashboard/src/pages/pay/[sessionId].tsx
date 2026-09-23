import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { navigateTopLevel } from '../../lib/navigation';

type Provider = 'MPESA' | 'STRIPE' | 'PAYPAL' | 'PESAPAL';
type CheckoutData = { id: string; merchantId: string; amountCents: number; currency: string; status: string; expiresAt: string; customer: { name?: string | null; email?: string | null; phone?: string | null } | null; environment: 'SANDBOX' | 'LIVE'; availableProviders: Array<{ provider: Provider; publicConfig: { publishableKey?: string | null; clientId?: string | null } }>; branding: { merchantName: string; logoUrl: string | null; primaryColor: string; secondaryColor: string; buttonColor: string } };
type StripeInstance = { elements: () => { create: (type: 'card') => StripeCardElement }; confirmCardPayment: (clientSecret: string, data: { payment_method: { card: StripeCardElement } }) => Promise<{ error?: { message?: string } }> };
type StripeCardElement = { mount: (selector: string) => void; unmount: () => void };
declare global { interface Window { Stripe?: (publishableKey: string) => StripeInstance | null } }

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

function unwrap<T>(payload: { success?: boolean; data?: T; message?: string }): T { if (!payload.success || payload.data === undefined) throw new Error(payload.message || 'PayHarness request failed'); return payload.data; }
async function apiRequest<T>(path: string, init?: RequestInit) { const response = await fetch(`${API_URL}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } }); const payload = (await response.json()) as { success?: boolean; data?: T; message?: string }; if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`); return unwrap(payload); }
function formatMoney(amountCents: number, currency: string) { return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amountCents / 100); }
function providerLabel(provider: Provider) { if (provider === 'MPESA') return 'M-Pesa'; if (provider === 'PAYPAL') return 'PayPal'; if (provider === 'PESAPAL') return 'Pesapal'; return 'Card'; }

export default function HostedCheckoutPage() {
  const router = useRouter();
  const sessionId = typeof router.query.sessionId === 'string' ? router.query.sessionId : '';
  const [checkout, setCheckout] = useState<CheckoutData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [phone, setPhone] = useState('');
  const [cardReady, setCardReady] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const cardRef = useRef<StripeCardElement | null>(null);
  const stripeRef = useRef<StripeInstance | null>(null);

  useEffect(() => { if (!sessionId) return; apiRequest<CheckoutData>(`/public/checkout-sessions/${sessionId}`).then((data) => { setCheckout(data); setSelectedProvider(data.availableProviders[0]?.provider || null); setPhone(data.customer?.phone || ''); }).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load checkout')).finally(() => setLoading(false)); }, [sessionId]);

  useEffect(() => {
    if (!sessionId || loading) return;
    let cancelled = false;
    const checkExistingStatus = async () => {
      try {
        const status = await apiRequest<{ status: string }>(`/public/checkout-sessions/${sessionId}/status`);
        if (cancelled) return;
        if (status.status === 'SUCCEEDED') navigateTopLevel(`/checkout/success?sessionId=${encodeURIComponent(sessionId)}`);
        if (status.status === 'FAILED') navigateTopLevel(`/checkout/failed?sessionId=${encodeURIComponent(sessionId)}`);
        if (status.status === 'CANCELED') navigateTopLevel(`/checkout/cancelled?sessionId=${encodeURIComponent(sessionId)}`);
      } catch {
        // Keep the checkout usable when the status check is temporarily unavailable.
      }
    };
    void checkExistingStatus();
    return () => { cancelled = true; };
  }, [sessionId, loading]);

  const stripeConfig = useMemo(() => checkout?.availableProviders.find((item) => item.provider === 'STRIPE')?.publicConfig.publishableKey || null, [checkout]);

  useEffect(() => {
    if (!stripeConfig || selectedProvider !== 'STRIPE' || typeof window === 'undefined') return;
    let cancelled = false;
    const setup = async () => {
      setStripeLoading(true);
      if (!window.Stripe) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector('script[data-payharness-stripe]') as HTMLScriptElement | null;
          if (existing) { existing.addEventListener('load', () => resolve(), { once: true }); existing.addEventListener('error', () => reject(new Error('Unable to load Stripe')), { once: true }); return; }
          const script = document.createElement('script'); script.src = 'https://js.stripe.com/v3/'; script.async = true; script.dataset.payharnessStripe = 'true'; script.onload = () => resolve(); script.onerror = () => reject(new Error('Unable to load Stripe')); document.head.appendChild(script);
        });
      }
      if (cancelled || !window.Stripe) return;
      const stripe = window.Stripe(stripeConfig); if (!stripe) throw new Error('Stripe could not be initialized');
      const card = stripe.elements().create('card'); card.mount('#payharness-card'); cardRef.current = card; stripeRef.current = stripe; setCardReady(true); setStripeLoading(false);
    };
    setup().catch((err) => { if (!cancelled) { setError(err instanceof Error ? err.message : 'Unable to initialize card payment'); setStripeLoading(false); } });
    return () => { cancelled = true; cardRef.current?.unmount(); cardRef.current = null; stripeRef.current = null; setCardReady(false); };
  }, [stripeConfig, selectedProvider]);

  const pollUntilFinished = async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const status = await apiRequest<{ status: string }>(`/public/checkout-sessions/${sessionId}/status`);
      if (status.status === 'SUCCEEDED') { navigateTopLevel(`/checkout/success?sessionId=${encodeURIComponent(sessionId)}`); return true; }
      if (['FAILED', 'CANCELED'].includes(status.status)) { navigateTopLevel(`/checkout/${status.status === 'CANCELED' ? 'cancelled' : 'failed'}?sessionId=${encodeURIComponent(sessionId)}`); return false; }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    setProcessing(false); setError('Payment is still processing. You can safely leave this page and return to the merchant.'); return false;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); if (!checkout || !selectedProvider) return; setProcessing(true); setError(''); setMessage('');
    try {
      if (selectedProvider === 'STRIPE') {
        if (!stripeRef.current || !cardRef.current || !cardReady) throw new Error('Card form is not ready yet');
        const payment = await apiRequest<{ clientSecret?: string }>(`/public/checkout-sessions/${sessionId}/payments`, { method: 'POST', body: JSON.stringify({ provider: 'STRIPE' }) });
        if (!payment.clientSecret) throw new Error('PayHarness did not return a Stripe client secret');
        const result = await stripeRef.current.confirmCardPayment(payment.clientSecret, { payment_method: { card: cardRef.current } });
        if (result.error) throw new Error(result.error.message || 'Card payment failed');
        // Stripe can confirm the PaymentIntent before its webhook reaches PayHarness.
        // Reconcile once immediately so hosted checkout does not wait for the webhook to settle the session.
        await apiRequest<{ status: string }>(`/public/checkout-sessions/${sessionId}/reconcile`, { method: 'POST' });
        await pollUntilFinished(); return;
      }
      const payment = await apiRequest<{ approvalUrl?: string }>(`/public/checkout-sessions/${sessionId}/payments`, { method: 'POST', body: JSON.stringify({ provider: selectedProvider, ...(selectedProvider === 'MPESA' ? { phoneNumber: phone } : {}) }) });
      if (['PAYPAL', 'PESAPAL'].includes(selectedProvider) && payment.approvalUrl) { navigateTopLevel(payment.approvalUrl); return; }
      setMessage(selectedProvider === 'MPESA' ? 'Check your phone and approve the M-Pesa prompt.' : 'Payment started.'); await pollUntilFinished();
    } catch (err) { setProcessing(false); setError(err instanceof Error ? err.message : 'Payment could not be started'); }
  };

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="text-sm text-slate-500">Loading secure checkout…</div></main>;
  if (!checkout) return <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6"><div className="w-full max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-semibold text-slate-900">Checkout unavailable</h1><p className="mt-2 text-sm text-slate-500">{error || 'This checkout session could not be loaded.'}</p></div></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-5 text-center">{checkout.branding.logoUrl ? <img src={checkout.branding.logoUrl} alt={checkout.branding.merchantName} className="mx-auto mb-4 h-10 max-w-40 object-contain" /> : null}<div className="text-sm font-medium text-slate-500">{checkout.branding.merchantName}</div></div>
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-6"><div className="text-sm text-slate-500">Amount due</div><div className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{formatMoney(checkout.amountCents, checkout.currency)}</div></div>
          <div className="p-6">
            {checkout.availableProviders.length === 0 ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No payment method is currently available for this checkout.</div> : (
              <form onSubmit={submit} className="space-y-5">
                <div><label className="mb-3 block text-sm font-semibold text-slate-900" htmlFor="payment-provider">Choose how to pay</label><select id="payment-provider" value={selectedProvider || ''} onChange={(event) => { setSelectedProvider(event.target.value as Provider); setError(''); setMessage(''); }} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-400"><option value="" disabled>Select a payment method</option>{checkout.availableProviders.map(({ provider }) => <option key={provider} value={provider}>{providerLabel(provider)}</option>)}</select></div>
                {selectedProvider === 'MPESA' ? <div><label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="phone">M-Pesa phone number</label><input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} required placeholder="2547XXXXXXXX" className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-slate-400" /></div> : null}
                {selectedProvider === 'STRIPE' ? <div><label className="mb-2 block text-sm font-medium text-slate-700">Card details</label><div id="payharness-card" className="rounded-2xl border border-slate-200 p-4" />{stripeLoading || !cardReady ? <p className="mt-2 text-xs text-slate-400">Preparing secure card fields…</p> : null}</div> : null}
                {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}
                {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div> : null}
                <button type="submit" disabled={processing || !selectedProvider || (selectedProvider === 'STRIPE' && !cardReady)} className="w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: checkout.branding.buttonColor }}>{processing ? 'Processing…' : `Pay ${formatMoney(checkout.amountCents, checkout.currency)}`}</button>
              </form>
            )}
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-slate-400">Secure payment powered by PayHarness</p>
      </div>
    </main>
  );
}
