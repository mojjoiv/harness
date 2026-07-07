import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle, StatCard } from '@/components/ui';

export default function PlatformDashboardPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Dashboard" description="Platform overview for PayHarness operations." />
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard label="Merchants" value="-" subtext="Connected merchant accounts" />
          <StatCard label="Subscriptions" value="-" subtext="Active merchant subscriptions" />
          <StatCard label="Platform Users" value="-" subtext="SaaS administration accounts" />
        </div>
        <Panel className="mt-4 p-6 text-sm text-muted">Platform metrics will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
