import { useEffect } from 'react';
import { Badge, Button, CopyButton, Panel } from '@/components/ui';
import { ProviderCredentialRecord, ProviderVerificationLogRecord } from '@/lib/types';
import { dateTime } from '@/lib/format';

type ProviderDetailsModalProps = {
  credential: ProviderCredentialRecord;
  history: ProviderVerificationLogRecord[];
  historyLoading: boolean;
  onClose: () => void;
  onVerify: () => void;
  onSetDefault: () => void;
  onDisconnect: () => void;
  busy: boolean;
};

const HEALTH_META: Record<string, { emoji: string; label: string; tone: 'neutral' | 'green' | 'red' | 'blue' }> = {
  VERIFIED: { emoji: '🟢', label: 'Healthy', tone: 'green' },
  PARTIALLY_VERIFIED: { emoji: '🟡', label: 'Partially Verified', tone: 'neutral' },
  PENDING: { emoji: '🟡', label: 'Pending Verification', tone: 'neutral' },
  INVALID: { emoji: '🔴', label: 'Invalid Credentials', tone: 'red' },
  DISABLED: { emoji: '⚫', label: 'Disabled', tone: 'neutral' },
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted">{label}</span>
      <span className="max-w-[65%] text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export function ProviderDetailsModal({ credential, history, historyLoading, onClose, onVerify, onSetDefault, onDisconnect, busy }: ProviderDetailsModalProps) {
  const health = HEALTH_META[credential.healthStatus] || HEALTH_META.PENDING;
  const isRevoked = credential.status === 'REVOKED';

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="provider-details-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-panel shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-panel px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-panelAlt text-lg font-semibold text-ink">
              {credential.provider === 'MPESA' ? 'M' : credential.provider === 'STRIPE' ? 'S' : 'P'}
            </div>
            <div>
              <h2 id="provider-details-title" className="text-xl font-semibold text-ink">
                {credential.provider === 'MPESA' ? 'M-Pesa' : credential.provider}
              </h2>
              <p className="text-sm text-muted">{credential.label}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close provider details" className="rounded-xl p-2 text-muted transition hover:bg-panelAlt hover:text-ink">
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-muted">Provider health</div>
              <div className="mt-1 text-sm text-muted">Review connection, verification and configuration details.</div>
            </div>
            <Badge tone={health.tone}>{health.emoji} {health.label}</Badge>
          </div>

          <Panel className="p-5">
            <h3 className="mb-2 text-base font-semibold text-ink">Provider Details</h3>
            <DetailRow label="Provider" value={credential.provider === 'MPESA' ? 'M-Pesa' : credential.provider} />
            <DetailRow label="Environment" value={credential.environment} />
            <DetailRow label="Status" value={credential.status} />
            <DetailRow label="Verification" value={credential.verificationStatus} />
            <DetailRow label="Default" value={credential.isDefault ? <Badge tone="blue">Default</Badge> : 'No'} />
            <DetailRow label="Created" value={dateTime(credential.createdAt)} />
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-2 text-base font-semibold text-ink">Configuration</h3>
            {credential.publicConfig && Object.keys(credential.publicConfig).length > 0 ? (
              Object.entries(credential.publicConfig).map(([key, value]) => (
                <DetailRow key={key} label={key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase())} value={typeof value === 'string' ? value : JSON.stringify(value)} />
              ))
            ) : (
              <div className="py-3 text-sm text-muted">No public configuration values returned.</div>
            )}
            <div className="flex items-center justify-between gap-4 border-b border-border py-3">
              <span className="text-sm text-muted">Webhook URL</span>
              <div className="flex max-w-[65%] items-center gap-2">
                <code className="truncate text-right text-xs text-ink">{credential.webhookUrl}</code>
                <CopyButton value={credential.webhookUrl} />
              </div>
            </div>
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-2 text-base font-semibold text-ink">Verification</h3>
            <DetailRow label="OAuth" value={credential.oauthVerified ? 'Verified' : 'Not verified'} />
            <DetailRow label="Account / shortcode" value={credential.accountVerified ? 'Verified' : 'Not verified'} />
            <DetailRow label="Environment" value={credential.environmentVerified ? 'Verified' : 'Not verified'} />
            <DetailRow label="Webhook" value={credential.webhookVerified ? 'Verified' : 'Not verified'} />
            <DetailRow label="Latency" value={credential.verificationLatencyMs != null ? `${credential.verificationLatencyMs}ms` : '—'} />
            <DetailRow label="Last verified" value={credential.lastVerifiedAt ? dateTime(credential.lastVerifiedAt) : 'Never'} />
            {credential.verificationWarnings.length > 0 ? (
              <div className="mt-3 rounded-2xl bg-panelAlt p-3 text-sm text-muted">
                <div className="font-medium text-ink">Warnings</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">{credential.verificationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            ) : null}
            {credential.verificationErrors.length > 0 ? (
              <div className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">
                <div className="font-medium">Errors</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">{credential.verificationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
              </div>
            ) : null}
            {credential.lastVerificationError ? <div className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">Last verification error: {credential.lastVerificationError}</div> : null}
            {credential.failedVerificationCount > 0 ? <div className="mt-3 text-xs text-muted">Failed verification attempts: {credential.failedVerificationCount}</div> : null}
          </Panel>

          <Panel className="p-5">
            <h3 className="text-base font-semibold text-ink">Last Updated</h3>
            <p className="mt-2 text-sm text-muted">{dateTime(credential.updatedAt)}</p>
          </Panel>

          <Panel className="p-5">
            <h3 className="mb-3 text-base font-semibold text-ink">Verification History</h3>
            {historyLoading ? (
              <div className="text-sm text-muted">Loading…</div>
            ) : history.length === 0 ? (
              <div className="text-sm text-muted">No verification attempts recorded yet.</div>
            ) : (
              <div className="space-y-2">
                {history.map((log) => (
                  <div key={log.id} className="rounded-2xl bg-panelAlt p-3 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-muted">{dateTime(log.createdAt)}</span>
                      <Badge tone={log.success ? 'green' : 'red'}>{log.success ? 'Success' : 'Failed'}</Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted sm:grid-cols-3">
                      <span>Environment: {log.environment}</span>
                      <span>OAuth: {log.oauthSucceeded ? 'Yes' : 'No'}</span>
                      <span>Latency: {log.responseTimeMs != null ? `${log.responseTimeMs}ms` : '—'}</span>
                    </div>
                    {log.failureReason ? <div className="mt-2 text-xs text-rose-700">{log.failureReason}</div> : null}
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
            {!isRevoked ? (
              <>
                <Button variant="secondary" disabled={busy} onClick={onVerify}>Verify</Button>
                {!credential.isDefault ? <Button variant="secondary" disabled={busy} onClick={onSetDefault}>Set Default</Button> : null}
                <Button variant="danger" disabled={busy} onClick={onDisconnect}>Disconnect</Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
