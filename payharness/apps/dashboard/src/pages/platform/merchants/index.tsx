import { useCallback, useEffect, useState } from 'react';
import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { SimpleTable } from '@/components/blocks';
import { Badge, Button, Panel, SectionTitle, Select } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { PlanRecord, PlatformMerchantRecord } from '@/lib/types';

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'red' | 'blue'> = {
  PENDING: 'blue',
  ACTIVE: 'green',
  SUSPENDED: 'red',
  REJECTED: 'red',
};

export default function PlatformMerchantsPage() {
  const [items, setItems] = useState<PlatformMerchantRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [planMenuFor, setPlanMenuFor] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [merchantsRes, plansRes] = await Promise.all([
        api.get<PlatformMerchantRecord[]>('/platform/merchants'),
        api.get<PlanRecord[]>('/platform/plans'),
      ]);
      setItems(merchantsRes.data);
      setPlans(plansRes.data.filter((plan) => plan.status === 'ACTIVE'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load merchants.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runAction = async (id: string, action: 'approve' | 'reject' | 'suspend' | 'activate') => {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/platform/merchants/${id}/${action}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} merchant.`);
    } finally {
      setBusyId(null);
    }
  };

  const openPlanMenu = (merchantId: string, currentPlanId?: string) => {
    setPlanMenuFor(merchantId);
    setSelectedPlan(currentPlanId || plans[0]?.id || '');
  };

  const confirmPlanChange = async (merchantId: string) => {
    if (!selectedPlan) return;
    setBusyId(merchantId);
    setError('');
    try {
      await api.patch(`/platform/merchants/${merchantId}/plan`, { planId: selectedPlan });
      setPlanMenuFor(null);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to change plan.');
    } finally {
      setBusyId(null);
    }
  };

  const rows = items.map((merchant) => {
    const owner = merchant.users[0]?.user;
    const plan = merchant.subscriptions[0]?.plan;
    const isBusy = busyId === merchant.id;
    const isChangingPlan = planMenuFor === merchant.id;

    return [
      merchant.name,
      owner ? `${owner.name} (${owner.email})` : '—',
      plan?.name || '—',
      <Badge key="status" tone={STATUS_TONE[merchant.status] || 'neutral'}>
        {merchant.status}
      </Badge>,
      merchant.profile?.country || '—',
      merchant._count.users,
      merchant._count.transactions,
      dateTime(merchant.createdAt),
      <div key="actions" className="flex flex-wrap items-start gap-2">
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
        {isChangingPlan ? (
          <div className="flex items-center gap-2">
            <Select value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value)}>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
            <Button variant="primary" disabled={isBusy} onClick={() => confirmPlanChange(merchant.id)}>
              Confirm
            </Button>
            <Button variant="ghost" disabled={isBusy} onClick={() => setPlanMenuFor(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            disabled={isBusy || plans.length === 0}
            onClick={() => openPlanMenu(merchant.id)}
          >
            Change Plan
          </Button>
        )}
      </div>,
    ];
  });

  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Merchants" description="All merchants owned by the PayHarness platform." />
        {error ? (
          <Panel className="mb-4 border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel>
        ) : null}
        {loading ? (
          <Panel className="p-6 text-sm text-muted">Loading merchants…</Panel>
        ) : (
          <SimpleTable
            headers={['Merchant', 'Owner', 'Plan', 'Status', 'Country', 'Users', 'Transactions', 'Created', 'Actions']}
            rows={rows}
            emptyText="No merchants yet."
          />
        )}
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
