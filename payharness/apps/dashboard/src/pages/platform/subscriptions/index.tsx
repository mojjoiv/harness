import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle } from '@/components/ui';

export default function PlatformSubscriptionsPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Subscriptions" description="Merchant subscription lifecycle and status." />
        <Panel className="p-6 text-sm text-muted">Subscription management will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
