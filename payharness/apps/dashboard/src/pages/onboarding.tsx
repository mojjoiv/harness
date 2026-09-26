import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/lib/api';
import { MerchantOnboardingStatus } from '@/lib/types';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';

function formatError(error: unknown) {
  if (error instanceof ApiError) return error.message;
  return error instanceof Error ? error.message : 'Unable to load your onboarding status.';
}

function statusTone(complete: boolean) {
  return complete ? 'green' as const : 'neutral' as const;
}

export default function OnboardingPage() {
  const [status, setStatus] = useState<MerchantOnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<MerchantOnboardingStatus>('/merchant/onboarding');
      setStatus(data);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Get started" description="Complete the setup needed to start accepting payments." />
        <Panel className="p-6 text-sm text-muted">Loading your onboarding checklist…</Panel>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="space-y-6">
        <SectionTitle title="Get started" description="Complete the setup needed to start accepting payments." />
        <Panel className="border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
          {error || 'Onboarding status is unavailable.'}
        </Panel>
        <Button variant="secondary" onClick={() => void load()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Get started"
        description={'Set up ' + status.merchant.name + ' for PayHarness payments.'}
        action={
          <Button variant="secondary" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <Panel className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">Merchant setup</h2>
              <Badge tone={status.merchant.status === 'ACTIVE' ? 'green' : 'blue'}>
                {status.merchant.status}
              </Badge>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Finish the required steps to become ready for sandbox payments. Live processing has additional verification requirements.
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold text-ink">{status.progress.percentage}%</div>
            <div className="text-xs text-muted">{status.progress.completed} of {status.progress.total} required steps</div>
          </div>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100" aria-label="Onboarding progress">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: status.progress.percentage + '%' }}
          />
        </div>
        {status.readyForSandbox ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            Your merchant workspace has completed all required sandbox onboarding steps.
          </div>
        ) : status.nextStep ? (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Next step</div>
            <div className="mt-1 font-semibold text-blue-950">{status.nextStep.title}</div>
            <p className="mt-1 text-sm text-blue-900">{status.nextStep.description}</p>
            <Link href={status.nextStep.href} className="mt-3 inline-flex rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">
              Continue setup
            </Link>
          </div>
        ) : null}
      </Panel>

      <div className="space-y-3">
        {status.steps.map((step, index) => (
          <Panel key={step.id} className="p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold">
                {step.complete ? '✓' : index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{step.title}</h3>
                  <Badge tone={statusTone(step.complete)}>
                    {step.complete ? 'Complete' : step.required ? 'Required' : 'Optional'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm leading-6 text-muted">{step.description}</p>
              </div>
              {!step.complete ? (
                <Link href={step.href} className="inline-flex shrink-0 rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-slate-50">
                  Set up
                </Link>
              ) : null}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="border-slate-200 bg-slate-50 p-5">
        <h2 className="font-semibold text-ink">Live payments</h2>
        <p className="mt-1 text-sm leading-6 text-muted">
          Live payment processing requires an approved merchant account, a verified live provider, a live API key, and a configured webhook. Keep live credentials server-side and never expose them in browser code.
        </p>
        <div className="mt-3">
          <Badge tone={status.readyForLive ? 'green' : 'neutral'}>
            {status.readyForLive ? 'Live setup complete' : 'Live setup not complete'}
          </Badge>
        </div>
      </Panel>
    </div>
  );
}
