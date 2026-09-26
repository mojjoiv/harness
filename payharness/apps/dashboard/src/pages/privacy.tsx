import { LegalPage } from '@/components/legal/LegalPage';

export default function PrivacyPage() {
  return <LegalPage
    title="Privacy Policy"
    effectiveDate="27 September 2026"
    intro="This product privacy notice should be reviewed and approved by the PayHarness service operator and qualified privacy/legal counsel before publication as a binding notice."
    sections={[
      { title: '1. Information we process', body: [
        'Depending on use, PayHarness may process merchant account and contact information, business/profile configuration, user and role information, API usage metadata, payment and transaction records, checkout sessions, webhook records, provider verification metadata, audit/security logs, and support communications.',
      ]},
      { title: '2. Why information is used', body: [
        'Information may be used to provide and secure the service, authenticate users, authorize merchant operations, process and reconcile payments, deliver webhooks and notifications, monitor health and security, investigate incidents, provide support, and comply with legal or contractual obligations.',
      ]},
      { title: '3. Data minimization', body: [
        'Integrations should send only metadata necessary for reconciliation and business operations. Avoid putting sensitive personal information into payment metadata unless required and appropriately protected.',
      ]},
      { title: '4. Providers and service providers', body: [
        'Payment operations may involve third-party payment providers and infrastructure providers. Information required to perform an enabled integration may be transmitted to the relevant provider.',
      ]},
      { title: '5. Security', body: [
        'PayHarness uses authentication, authorization, protected credential storage, signed webhooks, audit logging, rate limiting, security scanning, and production monitoring controls appropriate to the service.',
      ]},
      { title: '6. Retention and requests', body: [
        'Records are retained according to operational, contractual, reconciliation, security, and legal requirements. Privacy requests should use the support channel provided in the merchant account and may require identity verification.',
      ]},
      { title: '7. International processing', body: [
        'Infrastructure or payment providers may process information in countries other than the merchant location, subject to applicable contractual and legal requirements.',
      ]},
    ]}
  />;
}
