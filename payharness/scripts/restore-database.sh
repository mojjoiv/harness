#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${BACKUP_FILE:?BACKUP_FILE must point to a verified backup}"

if [[ "${ALLOW_DATABASE_RESTORE:-}" != "YES" ]]; then
  echo "Refusing database restore. Set ALLOW_DATABASE_RESTORE=YES after confirming the target database." >&2
  exit 1
fi

command -v pg_restore >/dev/null 2>&1 || {
  echo "pg_restore is required but was not found in PATH" >&2
  exit 1
}

[[ -f "${BACKUP_FILE}" ]] || {
  echo "Backup file does not exist: ${BACKUP_FILE}" >&2
  exit 1
}

if [[ "${BACKUP_FILE}" == *.gpg ]]; then
  command -v gpg >/dev/null 2>&1 || {
    echo "Encrypted backup detected but gpg was not found in PATH" >&2
    exit 1
  }
  DECRYPTED_FILE="$(mktemp "${TMPDIR:-/tmp}/payharness-restore.XXXXXX.dump")"
  trap 'rm -f "${DECRYPTED_FILE}"' EXIT
  gpg --batch --decrypt --output "${DECRYPTED_FILE}" "${BACKUP_FILE}"
  SOURCE_FILE="${DECRYPTED_FILE}"
else
  SOURCE_FILE="${BACKUP_FILE}"
fi

pg_restore \
  --dbname="${DATABASE_URL}" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --exit-on-error \
  "${SOURCE_FILE}"

echo "Database restore completed from: ${BACKUP_FILE}"
