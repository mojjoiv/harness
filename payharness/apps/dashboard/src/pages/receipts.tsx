import { useEffect, useState } from 'react';
import { useRouter } from 'next/compat/router';
import { ApiError, api } from '@/lib/api';
import { Badge, Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow } from '@/components/blocks';
import { dateTime, money } from '@/lib/format';

type Receipt = {
  id: string;
  merchantId: string;
  paymentId: string;
  receiptNumber: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  paymentStatus: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  issuedAt: string;
};

function statusTone(status: string) {
  return status.toUpperCase() === 'SUCCEEDED' ? ('green' as const) : ('neutral' as const);
}

export default function ReceiptsPage() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadReceipt = async (id: string) => {
    const normalizedId = id.trim();
    if (!normalizedId) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.get<Receipt>(`/payments/${encodeURIComponent(normalizedId)}/receipt`);
      setReceipt(response.data);
      setPaymentId(normalizedId);
    } catch (err) {
      setReceipt(null);
      setError(err instanceof ApiError ? err.message : 'Unable to load the payment receipt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const queryPaymentId = typeof router?.query?.paymentId === 'string' ? router.query.paymentId : '';
    if (queryPaymentId) {
      void loadReceipt(queryPaymentId);
    }
  }, [router?.query?.paymentId]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadReceipt(paymentId);
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Receipts"
        description="Retrieve and print a receipt for a succeeded payment."
        action={receipt ? <Button type="button" variant="secondary" onClick={() => window.print()}>Print receipt</Button> : undefined}
      />

      <Panel className="p-6 print:hidden">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={submit}>
          <div className="min-w-0 flex-1">
            <FieldRow label="Payment ID">
              <Input
                value={paymentId}
                onChange={(event) => setPaymentId(event.target.value)}
                placeholder="Enter a payment ID"
                autoComplete="off"
              />
            </FieldRow>
          </div>
          <Button type="submit" disabled={loading || !paymentId.trim()}>
            {loading ? 'Loading…' : 'View receipt'}
          </Button>
        </form>
      </Panel>

      {error ? <Panel className="border-rose-200 p-6 text-sm text-rose-700 print:hidden">{error}</Panel> : null}
      {!receipt && !loading && !error ? (
        <Panel className="p-8 text-center text-sm text-muted print:hidden">
          Enter a succeeded payment ID to retrieve its receipt.
        </Panel>
      ) : null}

      {receipt ? (
        <Panel className="mx-auto max-w-3xl p-6 sm:p-8 print:max-w-none print:border-0 print:shadow-none">
          <div className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Payment receipt</div>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">{receipt.receiptNumber}</h2>
              <div className="mt-1 text-sm text-muted">Issued {dateTime(receipt.issuedAt)}</div>
            </div>
            <Badge tone={statusTone(receipt.paymentStatus)}>{receipt.paymentStatus}</Badge>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Amount paid</div>
              <div className="mt-2 text-3xl font-bold text-ink">{money(receipt.amountCents, receipt.currency)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">Provider</div>
              <div className="mt-2 font-semibold text-ink">{receipt.provider}</div>
              <div className="mt-1 break-all text-sm text-muted">{receipt.providerReference || 'No provider reference'}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <Panel className="p-4">
              <div className="text-sm font-semibold text-ink">Customer</div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-muted">Name</dt><dd className="mt-1 font-medium">{receipt.customerName || '—'}</dd></div>
                <div><dt className="text-muted">Email</dt><dd className="mt-1 break-all font-medium">{receipt.customerEmail || '—'}</dd></div>
                <div><dt className="text-muted">Phone</dt><dd className="mt-1 font-medium">{receipt.customerPhone || '—'}</dd></div>
              </dl>
            </Panel>
            <Panel className="p-4">
              <div className="text-sm font-semibold text-ink">Payment details</div>
              <dl className="mt-4 space-y-3 text-sm">
                <div><dt className="text-muted">Payment ID</dt><dd className="mt-1 break-all font-medium">{receipt.paymentId}</dd></div>
                <div><dt className="text-muted">Receipt ID</dt><dd className="mt-1 break-all font-medium">{receipt.id}</dd></div>
                <div><dt className="text-muted">Currency</dt><dd className="mt-1 font-medium">{receipt.currency}</dd></div>
              </dl>
            </Panel>
          </div>

          <div className="mt-8 border-t border-line pt-5 text-xs text-muted">
            This receipt was generated from the PayHarness payment record and is merchant-scoped.
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
