import { PlatformAuthGate } from '@/components/auth';
import { PlatformLayout } from '@/components/layout';
import { Panel, SectionTitle } from '@/components/ui';

export default function PlatformUsersPage() {
  return (
    <PlatformAuthGate>
      <PlatformLayout>
        <SectionTitle title="Platform Users" description="Administrators and operators for the SaaS platform." />
        <Panel className="p-6 text-sm text-muted">Platform user management will appear here.</Panel>
      </PlatformLayout>
    </PlatformAuthGate>
  );
}
