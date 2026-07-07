import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle } from '@/components/ui';

export default function PlatformMerchantsPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Merchants" description="All merchants owned by the PayHarness platform." />
        <Panel className="p-6 text-sm text-muted">Merchant management will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
