import Head from 'next/head';
import { useEffect, useState } from 'react';
import { buildApiUrl } from '@/lib/api';

type StatusPayload = {
  status: 'operational' | 'degraded';
  updatedAt: string;
  components: Record<string, 'operational' | 'degraded'>;
  supportedProviders: string[];
  note: string;
};

const labels: Record<string, string> = {
  api: 'PayHarness API',
  database: 'Database',
  checkoutApi: 'Checkout API',
  webhookIngress: 'Webhook ingress',
};

export default function StatusPage() {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(buildApiUrl('/status'))
      .then(async (response) => {
        if (!response.ok) throw new Error('status request failed');
        const payload = await response.json();
        return payload.data ?? payload;
      })
      .then(setStatus)
      .catch(() => setError(true));
  }, []);

  return (
    <>
      <Head>
        <title>PayHarness Status</title>
        <meta name="description" content="Current PayHarness service status." />
      </Head>
      <main className="min-h-screen bg-slate-50 px-6 py-16 text-slate-900">
        <div className="mx-auto max-w-3xl">
          <div className="mb-10">
            <a href="/" className="text-sm font-semibold text-blue-700">← PayHarness</a>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight">Service status</h1>
            <p className="mt-3 text-slate-600">Operational status for PayHarness-controlled services.</p>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {error ? 'Status unavailable' : status?.status === 'degraded' ? 'Some services are degraded' : 'All systems operational'}
                </h2>
                {status?.updatedAt ? (
                  <p className="mt-1 text-sm text-slate-500">
                    Last checked {new Date(status.updatedAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className={status?.status === 'degraded' || error ? 'rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800' : 'rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800'}>
                {error ? 'Unknown' : status?.status === 'degraded' ? 'Degraded' : 'Operational'}
              </div>
            </div>

            <div className="mt-6 divide-y divide-slate-100">
              {Object.entries(status?.components || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-4">
                  <span className="font-medium">{labels[key] || key}</span>
                  <span className={value === 'operational' ? 'text-sm font-semibold text-emerald-700' : 'text-sm font-semibold text-amber-700'}>
                    {value === 'operational' ? 'Operational' : 'Degraded'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Supported payment integrations</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(status?.supportedProviders || ['MPESA', 'STRIPE', 'PAYPAL', 'PESAPAL', 'FLUTTERWAVE']).map((provider) => (
                <span key={provider} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
                  {provider === 'MPESA' ? 'M-Pesa' : provider[0] + provider.slice(1).toLowerCase()}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">
              {status?.note || 'Provider availability depends on merchant configuration and external provider systems.'}
            </p>
          </section>

          <p className="mt-8 text-sm text-slate-500">
            If you are investigating a payment issue, keep the PayHarness request ID and payment or webhook ID available for support.
          </p>
        </div>
      </main>
    </>
  );
}
