import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle } from '@/components/ui';

export default function PlatformPlansPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Plans" description="Subscription plans available to merchants." />
        <Panel className="p-6 text-sm text-muted">Plan management will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
