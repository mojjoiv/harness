# PayHarness Security Policy

**Effective date:** 27 September 2026

This document describes the security controls and responsible-disclosure process for PayHarness. It is an operational security statement, not a guarantee that vulnerabilities can never occur.

## Security controls

PayHarness maintains controls across:
- tenant-scoped authorization and role checks;
- environment-bound API keys;
- short-lived authentication and session controls;
- signed webhook verification;
- payment state and idempotency protections;
- encrypted provider credentials;
- audit logging;
- distributed rate limiting;
- dependency auditing and secret scanning;
- SAST and DAST;
- container vulnerability scanning and SBOM generation;
- non-root production containers;
- production health/readiness monitoring;
- backup and disaster-recovery procedures.

## Reporting a vulnerability

Report suspected security issues through the support channel provided in the merchant account and clearly mark the report as security-sensitive.

Include:
- affected component;
- concise reproduction steps;
- impact observed;
- relevant request IDs or resource IDs;
- suggested remediation if known.

Do not include live API keys, passwords, provider secrets, webhook secrets, or personal data in the initial report.

## Handling

Security reports are triaged, reproduced where safe, assigned a severity, remediated, tested, and closed with an audit trail. Confirmed credential exposure is handled through credential rotation and access review.

## Scope

This policy covers PayHarness-controlled application code and infrastructure. It does not make claims about the independent security of external payment providers or merchant-controlled systems.

## Operational status

Service health is published through the public status page and the `GET /status` endpoint.
