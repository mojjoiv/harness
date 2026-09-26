import { LegalPage } from '@/components/legal/LegalPage';

export default function SecurityPage() {
  return <LegalPage
    title="Security"
    effectiveDate="27 September 2026"
    intro="This security statement describes PayHarness security controls and responsible-disclosure handling. It is not a guarantee that vulnerabilities can never occur."
    sections={[
      { title: 'Security controls', body: [
        'PayHarness maintains tenant-scoped authorization, environment-bound API keys, short-lived authentication/session controls, signed webhook verification, payment state and idempotency protections, encrypted provider credentials, audit logging, distributed rate limiting, dependency auditing, secret scanning, SAST, DAST, container scanning, SBOM generation, non-root production containers, health/readiness monitoring, and disaster-recovery procedures.',
      ]},
      { title: 'Reporting a vulnerability', body: [
        'Report suspected security issues through the security-sensitive support channel provided in the merchant account. Include the affected component, reproduction steps, observed impact, and relevant request/resource IDs.',
        'Do not include live API keys, passwords, provider secrets, webhook secrets, or personal data in the initial report.',
      ]},
      { title: 'Handling', body: [
        'Security reports are triaged, reproduced where safe, assigned a severity, remediated, tested, and closed with an audit trail. Confirmed credential exposure is handled through credential rotation and access review.',
      ]},
      { title: 'Scope', body: [
        'This statement covers PayHarness-controlled application code and infrastructure. It does not make claims about the independent security of external payment providers or merchant-controlled systems.',
      ]},
      { title: 'Operational status', body: [
        'Current PayHarness-controlled service health is published on the public status page. Provider availability can depend on external provider systems and merchant configuration.',
      ]},
    ]}
  />;
}
