# PayHarness Security Certification

Phase 15 hardens the API's production security boundary and provides an executable certification check.

## Controls

- Strict allow-list CORS in every environment; unknown origins are rejected.
- Security response headers are applied globally.
- HSTS is enabled in production.
- Express trust-proxy behavior is explicit for deployments behind a TLS proxy.
- Swagger/OpenAPI is disabled by default in production and can only be enabled explicitly with `SWAGGER_ENABLED=true`.
- DTO validation rejects non-whitelisted request properties.
- Existing global rate limiting remains enabled.
- API keys remain server-side credentials and are not exposed through browser code.

## Certification

From `payharness/` run:

```bash
npm run verify:security
npm run verify:integrations
npm run test:api
npm run typecheck
npm run lint
npm run format:check
```

The normal CI pipeline is authoritative. This certification is an additional regression guard for security-sensitive bootstrap configuration.

## Production configuration

Set the following values deliberately in production:

- `NODE_ENV=production`
- `FRONTEND_URL`
- `APP_URL`
- `CHECKOUT_URL`
- `SWAGGER_ENABLED=false` (recommended; the default production behavior is disabled)

Only HTTPS application URLs should be used for production origins.
