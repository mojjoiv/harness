#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${SUPERADMIN_EMAIL:?SUPERADMIN_EMAIL must be set}"
: "${SUPERADMIN_PASSWORD:?SUPERADMIN_PASSWORD must be set}"
: "${SUPERADMIN_NAME:?SUPERADMIN_NAME must be set}"

echo "Applying Prisma migrations..."
npx prisma migrate deploy

echo "Ensuring production superadmin exists..."
npx ts-node prisma/seed.ts

echo "Starting PayHarness API..."
exec node dist/main.js
