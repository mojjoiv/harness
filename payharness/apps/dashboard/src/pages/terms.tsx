import { LegalPage } from '@/components/legal/LegalPage';

export default function TermsPage() {
  return <LegalPage
    title="Terms of Service"
    effectiveDate="27 September 2026"
    intro="These product terms should be reviewed and approved by the PayHarness service operator and qualified legal counsel before being presented as a binding agreement."
    sections={[
      { title: '1. Service', body: [
        'PayHarness provides payment integration infrastructure, including merchant onboarding, payment APIs, hosted checkout, provider integrations, webhooks, dashboards, and related developer tools.',
        'Specific providers, countries, currencies, environments, and capabilities may vary by merchant configuration and provider availability.',
      ]},
      { title: '2. Merchant responsibilities', body: [
        'Merchants are responsible for accurate account and business information, credential security, correct integration configuration, applicable laws and provider rules, transaction records, and reviewing payment state before fulfilling orders.',
      ]},
      { title: '3. Credentials and security', body: [
        'API keys, webhook secrets, provider credentials, and passwords must be kept confidential. Suspected exposure should be reported and affected credentials rotated promptly.',
      ]},
      { title: '4. Payments and providers', body: [
        'Payment outcomes can depend on provider systems, network conditions, account configuration, and provider rules. A successful browser redirect is not itself a guarantee of final payment settlement.',
      ]},
      { title: '5. Fees', body: [
        'Applicable PayHarness, transaction, provider, or other commercial fees are governed by the pricing or order agreement shown to the merchant.',
      ]},
      { title: '6. Acceptable use', body: [
        'The service must not be used for unlawful activity, fraud, credential abuse, sanctions evasion, or activity prohibited by applicable provider or network rules.',
      ]},
      { title: '7. Availability', body: [
        'PayHarness operates production monitoring and incident procedures. Unless a separate written service-level agreement applies, status information and operational targets do not create a guaranteed uptime commitment.',
      ]},
      { title: '8. Suspension', body: [
        'Access may be restricted or suspended where necessary for security, fraud prevention, legal compliance, provider requirements, non-payment, or material violation of these terms.',
      ]},
      { title: '9. Contact', body: [
        'Support requests should use the support channel provided in the merchant account. Never include API keys, passwords, provider secrets, or webhook secrets in support messages.',
      ]},
    ]}
  />;
}
