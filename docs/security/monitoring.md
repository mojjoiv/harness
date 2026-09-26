# PayHarness Security Monitoring

Production monitoring should alert on:

- repeated HTTP 401/403/429 responses by merchant, API key, account, and source;
- refresh-token reuse or session-reuse detection;
- webhook signature verification failures;
- webhook amount/currency mismatches;
- repeated payment or payout state-transition failures;
- payout execution failures and reconciliation discrepancies;
- ledger posting failures or unbalanced journal attempts;
- provider credential decryption or authentication failures;
- unexpected spikes in authentication and API traffic;
- readiness failures and database connectivity errors.

Every alert should retain the request ID or other correlation identifier where available.

Security telemetry must avoid storing:

- passwords;
- raw JWTs;
- raw refresh tokens;
- API key secrets;
- provider secret material;
- full card data.

Use the existing audit and observability records as the durable investigation trail.
