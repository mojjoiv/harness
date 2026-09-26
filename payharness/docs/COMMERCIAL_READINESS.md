# Phase 6 — Commercial Readiness

This release groups the remaining Phase 6 commercial-readiness work into one implementation:

| Item | Deliverable | Gate |
|---|---|---|
| 37 | Complete API reference and integration guidance | Documentation + CI |
| 38 | SDK guide for JS/TS, Go, PHP, Python | Documentation + existing SDK tests |
| 39 | Public service status endpoint and page | API/dashboard tests |
| 40 | Terms, privacy, and security policy pages | Dashboard build |
| 41 | Support and incident workflow | Operational documentation |
| 42 | Provider certification gate and capability matrix | Automated CI certification |

## Production-use notes

- Legal documents are implementation drafts and require operator/legal approval before publication as binding terms or notices.
- Provider certification is an internal adapter/contract gate and does not replace external provider approval.
- The status page reports PayHarness-controlled API/database state; it does not claim that external provider systems are continuously operational.
- SDK packages remain in the monorepo until a public package release is deliberately approved.

## Verification

Run:

```bash
npm run verify:providers
npm run verify:integrations
npm run typecheck
npm test
npm run build
```

The normal CI and Security workflows remain mandatory. No security gate is skipped or weakened for commercial-readiness work.
