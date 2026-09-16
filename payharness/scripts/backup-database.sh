#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BASE_NAME="payharness-${TIMESTAMP}.dump"
TMP_FILE="${BACKUP_DIR}/${BASE_NAME}.tmp"
FINAL_FILE="${BACKUP_DIR}/${BASE_NAME}"

mkdir -p "${BACKUP_DIR}"
trap 'rm -f "${TMP_FILE}"' EXIT

command -v pg_dump >/dev/null 2>&1 || {
  echo "pg_dump is required but was not found in PATH" >&2
  exit 1
}

pg_dump \
  --dbname="${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${TMP_FILE}"

mv "${TMP_FILE}" "${FINAL_FILE}"

if [[ -n "${GPG_RECIPIENT:-}" ]]; then
  command -v gpg >/dev/null 2>&1 || {
    echo "GPG_RECIPIENT is set but gpg was not found in PATH" >&2
    exit 1
  }
  gpg --batch --yes --trust-model always --recipient "${GPG_RECIPIENT}" --output "${FINAL_FILE}.gpg" --encrypt "${FINAL_FILE}"
  rm -f "${FINAL_FILE}"
  FINAL_FILE="${FINAL_FILE}.gpg"
fi

find "${BACKUP_DIR}" -type f -name 'payharness-*.dump' -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -type f -name 'payharness-*.dump.gpg' -mtime "+${RETENTION_DAYS}" -delete

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${FINAL_FILE}" > "${FINAL_FILE}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "${FINAL_FILE}" > "${FINAL_FILE}.sha256"
else
  echo "Warning: neither sha256sum nor shasum is available; checksum was not created" >&2
fi

echo "Database backup created: ${FINAL_FILE}"
