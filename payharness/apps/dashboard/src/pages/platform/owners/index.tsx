import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { SimpleTable } from '@/components/blocks';
import { Badge, Button, Panel, SectionTitle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PlatformOwnerRecord } from '@/lib/types';

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'red' | 'blue'> = {
  PENDING: 'blue',
  ACTIVE: 'green',
  SUSPENDED: 'red',
  REJECTED: 'red',
};

export default function PlatformOwnersPage() {
  const [items, setItems] = useState<PlatformOwnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlatformOwnerRecord[]>('/platform/owners');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load owners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (merchantId: string, action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    setBusyId(merchantId);
    setError('');
    try {
      await api.patch(`/platform/merchants/${merchantId}/${action}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} merchant.`);
    } finally {
      setBusyId(null);
    }
  };

  const rows = items.map((owner) => {
    const merchant = owner.merchant;
    const plan = merchant.subscriptions[0]?.plan;
    const isBusy = busyId === merchant.id;

    return [
      owner.user.name,
      merchant.name,
      owner.user.email,
      merchant.profile?.country || '—',
      plan?.name || '—',
      <Badge key="status" tone={STATUS_TONE[merchant.status] || 'neutral'}>
        {merchant.status}
      </Badge>,
      dateTime(owner.createdAt),
      <div key="actions" className="flex flex-wrap gap-2">
        {merchant.status === 'PENDING' && (
          <>
            <Button variant="primary" disabled={isBusy} onClick={() => runAction(merchant.id, 'approve')}>
              Approve
            </Button>
            <Button variant="danger" disabled={isBusy} onClick={() => runAction(merchant.id, 'reject')}>
              Reject
            </Button>
          </>
        )}
        {merchant.status === 'ACTIVE' && (
          <Button variant="secondary" disabled={isBusy} onClick={() => runAction(merchant.id, 'suspend')}>
            Suspend
          </Button>
        )}
        {merchant.status === 'SUSPENDED' && (
          <Button variant="primary" disabled={isBusy} onClick={() => runAction(merchant.id, 'activate')}>
            Activate
          </Button>
        )}
        <Link href="/platform/merchants" className="inline-flex items-center rounded-xl border border-line bg-white px-3 py-2 text-sm hover:bg-slate-50">
          View Merchant
        </Link>
      </div>,
    ];
  });

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Owners" description="Every merchant organization owner on the platform." />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading owners…</Panel>
        ) : (
          <SimpleTable
            headers={['Owner', 'Merchant', 'Business Email', 'Country', 'Plan', 'Status', 'Created', 'Actions']}
            rows={rows}
            emptyText="No owners yet."
          />
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
