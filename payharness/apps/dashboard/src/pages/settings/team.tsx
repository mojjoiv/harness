import { useCallback, useEffect, useState } from 'react';
import { SimpleTable, FieldRow, FormGrid } from '@/components/blocks';
import { Badge, Button, Input, Panel, SectionTitle, Select } from '@/components/ui';
import { ApiError, api } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { OwnerUserRecord } from '@/lib/types';

const INVITABLE_ROLES = ['ADMIN', 'DEVELOPER', 'VIEWER'] as const;

const STATUS_TONE: Record<string, 'neutral' | 'green' | 'red'> = {
  ACTIVE: 'green',
  DEACTIVATED: 'red',
};

interface InviteFormState {
  name: string;
  email: string;
  role: (typeof INVITABLE_ROLES)[number];
}

const EMPTY_INVITE: InviteFormState = { name: '', email: '', role: 'VIEWER' };

export default function TeamSettingsPage() {
  const [items, setItems] = useState<OwnerUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite] = useState<InviteFormState>(EMPTY_INVITE);
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const [tempPassword, setTempPassword] = useState<{ id: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<OwnerUserRecord[]>('/owner/users');
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your team.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitInvite = async () => {
    setInviting(true);
    setInviteError('');
    try {
      await api.post('/owner/users', invite);
      setShowInvite(false);
      setInvite(EMPTY_INVITE);
      await load();
    } catch (err) {
      setInviteError(err instanceof ApiError ? err.message : 'Failed to add teammate.');
    } finally {
      setInviting(false);
    }
  };

  const runAction = async (id: string, action: 'deactivate' | 'reactivate' | 'remove') => {
    setBusyId(id);
    setError('');
    try {
      if (action === 'remove') {
        await api.delete(`/owner/users/${id}`);
      } else {
        await api.patch(`/owner/users/${id}/${action}`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Failed to ${action} teammate.`);
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const { data } = await api.patch<{ temporaryPassword: string }>(`/owner/users/${id}/reset-password`);
      setTempPassword({ id, password: data.temporaryPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password.');
    } finally {
      setBusyId(null);
    }
  };

  const rows = items.map((member) => {
    const isBusy = busyId === member.id;

    return [
      member.user.name,
      member.user.email,
      member.role,
      <Badge key="status" tone={STATUS_TONE[member.status] || 'neutral'}>
        {member.status}
      </Badge>,
      dateTime(member.createdAt),
      member.role === 'OWNER' ? (
        <span key="actions" className="text-sm text-muted">
          —
        </span>
      ) : (
        <div key="actions" className="flex flex-wrap gap-2">
          {member.status === 'ACTIVE' ? (
            <Button variant="secondary" disabled={isBusy} onClick={() => runAction(member.id, 'deactivate')}>
              Deactivate
            </Button>
          ) : (
            <Button variant="primary" disabled={isBusy} onClick={() => runAction(member.id, 'reactivate')}>
              Reactivate
            </Button>
          )}
          <Button variant="secondary" disabled={isBusy} onClick={() => resetPassword(member.id)}>
            Reset Password
          </Button>
          <Button variant="danger" disabled={isBusy} onClick={() => runAction(member.id, 'remove')}>
            Remove
          </Button>
        </div>
      ),
    ];
  });

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Team"
        description="People with access to this organization."
        action={<Button onClick={() => setShowInvite(true)}>Add Teammate</Button>}
      />

      {error ? <Panel className="border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</Panel> : null}

      {tempPassword ? (
        <Panel className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="font-medium">Temporary password generated</div>
          <div className="mt-1">
            This will only be shown once. Share it with the teammate securely, then have them change it after
            logging in.
          </div>
          <code className="mt-2 inline-block rounded bg-white px-3 py-1 font-mono text-sm">
            {tempPassword.password}
          </code>
          <div className="mt-2">
            <Button variant="ghost" onClick={() => setTempPassword(null)}>
              Dismiss
            </Button>
          </div>
        </Panel>
      ) : null}

      {showInvite ? (
        <Panel className="p-6">
          <h2 className="mb-4 text-lg font-semibold text-ink">Add Teammate</h2>
          {inviteError ? <div className="mb-4 text-sm text-rose-700">{inviteError}</div> : null}
          <FormGrid>
            <FieldRow label="Name">
              <Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} />
            </FieldRow>
            <FieldRow label="Email">
              <Input
                type="email"
                value={invite.email}
                onChange={(e) => setInvite({ ...invite, email: e.target.value })}
              />
            </FieldRow>
            <FieldRow label="Role">
              <Select
                value={invite.role}
                onChange={(e) => setInvite({ ...invite, role: e.target.value as InviteFormState['role'] })}
              >
                {INVITABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </Select>
            </FieldRow>
          </FormGrid>
          <div className="mt-4 flex gap-2">
            <Button disabled={inviting} onClick={submitInvite}>
              {inviting ? 'Adding…' : 'Add Teammate'}
            </Button>
            <Button variant="ghost" disabled={inviting} onClick={() => setShowInvite(false)}>
              Cancel
            </Button>
          </div>
        </Panel>
      ) : null}

      {loading ? (
        <Panel className="p-6 text-sm text-muted">Loading your team…</Panel>
      ) : (
        <SimpleTable
          headers={['Name', 'Email', 'Role', 'Status', 'Added', 'Actions']}
          rows={rows}
          emptyText="No team members yet."
        />
      )}
    </div>
  );
}
