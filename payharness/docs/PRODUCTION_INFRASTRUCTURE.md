# PayHarness Production Infrastructure

## Phase 5 scope

Phase 5 establishes the production infrastructure controls around the application:

- hardened API and dashboard containers;
- non-root runtime containers with health checks;
- database migrations separated from API process startup;
- immutable GHCR container release tags tied to Git commit SHA;
- provenance and SBOM generation for released images;
- production liveness/readiness smoke monitoring;
- managed PostgreSQL with point-in-time recovery (PITR);
- tested database backup and restore procedures;
- explicit recovery objectives and operational ownership.

## Container release model

The `container-release.yml` workflow publishes the API and dashboard images to GHCR on every `main` push.

Every image receives:

- `sha-<full commit SHA>` — immutable release identifier used to identify the source revision;
- `build-<GitHub Actions run ID>` — traceable build identifier;
- OCI revision/source labels;
- BuildKit provenance;
- an SBOM.

The deployment system should record the exact image digest used for production. Do not deploy `latest` as the production release identifier.

## Container hardening

Production containers:

- run as the unprivileged `node` user;
- contain only runtime dependencies after `npm prune --omit=dev`;
- expose only the application port;
- include liveness/readiness health checks;
- do not run Prisma migrations or seed data during API process startup.

Database migrations are a deployment concern and must complete before the API is marked ready.

## PostgreSQL

Production must use a managed PostgreSQL service rather than the Docker Compose database.

Required controls:

1. TLS-encrypted database connections.
2. Automated backups.
3. Point-in-time recovery (PITR), where supported by the managed provider.
4. Backup retention appropriate to the business's financial-data requirements.
5. Restricted database credentials with least privilege.
6. A separate direct/admin connection for Prisma migrations where the provider supports it.
7. Monitoring for connection exhaustion, storage, CPU, memory and backup failures.
8. At least one isolated restore target for recovery drills.

`DATABASE_URL` is the runtime application connection. `DIRECT_DATABASE_URL` is available for Prisma administrative/migration operations.

The local PostgreSQL service in `docker-compose.yml` is for development and recovery drills only. It is not a production database.

## Render deployment

The current Render blueprint deploys PayHarness using the Node runtime and runs Prisma setup in `preDeployCommand`. That is intentionally separate from application startup.

Production database provisioning, PITR retention, backup policy and restore targets must be configured in the managed PostgreSQL service used by Render. Do not put database passwords or backup credentials in Git.

If the deployment platform is changed to container-based deployment later, use the commit-SHA image produced by the immutable container release workflow rather than a mutable `latest` tag.

## Monitoring

The scheduled production smoke workflow checks:

- `/health`;
- `/health/readiness`;
- HTTP 200 responses from both endpoints.

The application security monitoring requirements remain documented in `docs/security/monitoring.md`. Production operations should additionally alert on:

- database connectivity/readiness failures;
- repeated application restarts;
- container health-check failures;
- high CPU/memory;
- database storage growth;
- connection saturation;
- backup/PITR failures;
- failed restore drills.

## Disaster recovery

The logical `pg_dump`/`pg_restore` scripts remain a secondary recovery mechanism. Managed PostgreSQL PITR is the primary recovery mechanism when supported.

The recovery runbook defines:

- RPO target: 24 hours or better;
- RTO target: 4 hours;
- quarterly restore drills;
- checksum verification;
- optional GPG encryption;
- post-restore application and financial-data validation.

See `docs/DISASTER_RECOVERY.md`.

## Operational rule

A production release is not complete merely because the application builds.

The release must have:

1. a known Git commit;
2. a known container image digest if containers are used;
3. successful CI/security checks;
4. a healthy database migration;
5. passing liveness/readiness checks;
6. active database backup/PITR protection;
7. a tested recovery procedure.
