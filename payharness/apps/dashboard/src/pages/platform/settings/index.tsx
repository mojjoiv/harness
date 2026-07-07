import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle } from '@/components/ui';

export default function PlatformSettingsPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Settings" description="Platform-wide administration settings." />
        <Panel className="p-6 text-sm text-muted">Platform settings will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
