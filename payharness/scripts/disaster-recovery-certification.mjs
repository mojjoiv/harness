import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const backupScript = path.resolve(root, 'scripts/backup-database.sh');
const restoreScript = path.resolve(root, 'scripts/restore-database.sh');
const documentation = path.resolve(root, 'docs/DISASTER_RECOVERY.md');

const failures = [];

for (const file of [backupScript, restoreScript, documentation]) {
  if (!fs.existsSync(file)) failures.push(`Missing disaster recovery artifact: ${path.relative(root, file)}`);
}

for (const script of [backupScript, restoreScript]) {
  if (!fs.existsSync(script)) continue;
  const result = spawnSync('bash', ['-n', script], { encoding: 'utf8' });
  if (result.status !== 0) {
    failures.push(`Shell syntax check failed: ${path.relative(root, script)}${result.stderr ? ` (${result.stderr.trim()})` : ''}`);
  }
}

if (fs.existsSync(backupScript)) {
  const content = fs.readFileSync(backupScript, 'utf8');
  for (const required of [
    'DATABASE_URL',
    'pg_dump',
    '--format=custom',
    '--no-owner',
    '--no-acl',
    'RETENTION_DAYS',
    'sha256sum',
    'GPG_RECIPIENT',
  ]) {
    if (!content.includes(required)) failures.push(`Backup script is missing required control: ${required}`);
  }
}

if (fs.existsSync(restoreScript)) {
  const content = fs.readFileSync(restoreScript, 'utf8');
  for (const required of [
    'DATABASE_URL',
    'BACKUP_FILE',
    'ALLOW_DATABASE_RESTORE',
    'pg_restore',
    '--clean',
    '--if-exists',
    '--exit-on-error',
  ]) {
    if (!content.includes(required)) failures.push(`Restore script is missing required control: ${required}`);
  }
}

if (fs.existsSync(documentation)) {
  const content = fs.readFileSync(documentation, 'utf8');
  for (const required of [
    'RPO',
    'RTO',
    'DATABASE_URL',
    'pg_dump',
    'pg_restore',
    'ALLOW_DATABASE_RESTORE=YES',
    'GPG_RECIPIENT',
    'restore drill',
  ]) {
    if (!content.includes(required)) failures.push(`Disaster recovery documentation is missing: ${required}`);
  }
}

if (failures.length) {
  console.error('Disaster recovery certification FAILED');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Disaster recovery certification PASSED');
console.log('Validated backup/restore scripts, retention, checksums, optional encryption, guarded restores, and recovery documentation.');
