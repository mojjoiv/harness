import { useCallback, useEffect, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { SimpleTable } from '@/components/blocks';
import { Button, Panel, SectionTitle } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PlatformMerchantRecord } from '@/lib/types';

export default function PlatformPendingApprovalsPage() {
  const [items, setItems] = useState<PlatformMerchantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<PlatformMerchantRecord[]>('/platform/merchants?status=PENDING');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load pending registrations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, action: 'approve' | 'reject') => {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/platform/merchants/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} registration.`);
    } finally {
      setBusyId(null);
    }
  };

  const rows = items.map((merchant) => {
    const owner = merchant.users[0]?.user;
    const isBusy = busyId === merchant.id;

    return [
      merchant.profile?.businessName || merchant.name,
      owner?.name || '—',
      owner?.email || '—',
      merchant.profile?.country || '—',
      dateTime(merchant.createdAt),
      merchant.status,
      <div key="actions" className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={isBusy} onClick={() => runAction(merchant.id, 'approve')}>
          Approve
        </Button>
        <Button variant="danger" disabled={isBusy} onClick={() => runAction(merchant.id, 'reject')}>
          Reject
        </Button>
      </div>,
    ];
  });

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Pending Approvals" description="New merchant registrations awaiting review." />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading pending registrations…</Panel>
        ) : (
          <SimpleTable
            headers={['Business', 'Owner', 'Email', 'Country', 'Registered', 'Status', 'Actions']}
            rows={rows}
            emptyText="No registrations awaiting approval."
          />
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
