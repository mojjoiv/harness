# PayHarness Incident Response

## Severity levels

- **SEV-1:** confirmed credential compromise, unauthorized financial activity, or broad production outage.
- **SEV-2:** material security degradation, repeated authentication abuse, provider integrity issue, or significant customer impact.
- **SEV-3:** isolated suspicious activity, non-critical security defect, or monitoring anomaly.

## Immediate response

1. Preserve request IDs, timestamps, audit events, provider references, and relevant deployment identifiers.
2. Revoke affected API keys and user sessions.
3. Rotate compromised provider credentials, JWT secrets, encryption keys, or Redis credentials as applicable.
4. Suspend affected merchant/provider operations when financial integrity cannot be established.
5. Review payment, payout, webhook, ledger, and audit records for unauthorized state changes.
6. Record the incident timeline and every containment action.
7. Restore service only after the affected control has been verified.

## Financial incidents

For suspected payment or payout manipulation:

- stop the affected execution path;
- reconcile provider state against PayHarness state;
- preserve the immutable audit trail;
- verify ledger balance and source-event idempotency;
- do not manually alter financial records to hide or bypass an incident.

## Post-incident

Within the post-incident review, document:

- root cause;
- affected tenants and systems;
- detection and response times;
- financial exposure;
- containment and recovery actions;
- corrective controls and tests.

Do not include secrets, tokens, passwords, or full payment credentials in incident records.
