# PayHarness Disaster Recovery & Database Backups

## Scope

This runbook covers PostgreSQL backup, verification, retention, optional encryption, and controlled restore for PayHarness.

Application source code and configuration remain recoverable from Git. Database backups protect merchant, payment, transaction, webhook, audit, API-key, and related persistent state.

## Recovery objectives

- **RPO target:** 24 hours or better, depending on the managed PostgreSQL backup schedule selected by the production operator.
- **RTO target:** 4 hours for a database restore plus application validation, subject to provider restore speed and infrastructure availability.
- Managed PostgreSQL point-in-time recovery should be enabled in production where the database provider supports it.
- The logical `pg_dump` workflow below is a secondary recovery mechanism, not a replacement for managed database backups.

## Backup procedure

From `payharness/`:

```bash
DATABASE_URL='postgresql://...' BACKUP_DIR='./backups' RETENTION_DAYS=14 bash scripts/backup-database.sh
```

The backup uses PostgreSQL custom format, excludes ownership and ACL restoration, writes atomically through a temporary file, removes old dumps according to `RETENTION_DAYS`, and creates a SHA-256 checksum.

For encrypted backup artifacts, provide a GPG public-key recipient:

```bash
DATABASE_URL='postgresql://...' GPG_RECIPIENT='backup@example.com' bash scripts/backup-database.sh
```

Private encryption keys must remain outside the repository and outside application environment variables where practical. Store backup artifacts in a separate access-controlled storage location; do not rely on the application host as the only copy.

## Restore procedure

A restore is destructive to the target database. First verify the backup checksum and confirm the target database is the intended recovery environment.

For an unencrypted dump:

```bash
DATABASE_URL='postgresql://...' BACKUP_FILE='./backups/payharness-YYYYMMDDTHHMMSSZ.dump' ALLOW_DATABASE_RESTORE=YES bash scripts/restore-database.sh
```

For an encrypted dump, provide the GPG private key through the host's normal key-management mechanism, then run the same command with the `.dump.gpg` file.

The restore script requires `ALLOW_DATABASE_RESTORE=YES` to prevent accidental execution. It uses `pg_restore --clean --if-exists --exit-on-error` and does not restore object ownership or ACLs.

After restore:

1. Apply the current Prisma migrations with `npm run prisma:migrate:deploy`.
2. Start the API against the restored database.
3. Run health checks and the existing integration/security certification commands.
4. Verify representative merchant, payment, transaction, webhook, and API-key records.
5. Verify webhook delivery/retry processing and payment status reads.
6. Record the restore timestamp, source backup, target environment, validation results, and any anomalies.

## Restore drill

A restore drill should be performed at least quarterly and after material database/schema changes. Use an isolated recovery database, never the production database.

The drill should demonstrate:

- A known backup can be located and its checksum verified.
- An encrypted backup can be decrypted when encryption is enabled.
- PostgreSQL can restore the dump without ownership/ACL assumptions.
- Current migrations apply successfully.
- The application can boot against the restored database.
- Representative payment and merchant data is intact.
- The measured recovery duration remains within the RTO target.

## Operational controls

- Keep production database credentials out of scripts, Git, and backup filenames.
- Restrict backup storage access to operators who need it.
- Keep at least one backup copy separate from the primary database infrastructure.
- Monitor backup job success and storage capacity.
- Alert on missed backup windows and failed restore drills.
- Rotate encryption keys according to the organization's key-management policy.
- Never commit real backup files, database dumps, credentials, or private encryption keys.

## Certification

Run the repository-level checks with:

```bash
npm run verify:disaster-recovery
```

The certification validates the presence and shell syntax of the recovery scripts and checks that the documented controls remain represented in the runbook.
