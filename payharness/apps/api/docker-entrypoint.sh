#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"
: "${SUPERADMIN_EMAIL:?SUPERADMIN_EMAIL must be set}"
: "${SUPERADMIN_PASSWORD:?SUPERADMIN_PASSWORD must be set}"
: "${SUPERADMIN_NAME:?SUPERADMIN_NAME must be set}"

echo "Applying Prisma migrations..."
./node_modules/.bin/prisma migrate deploy

echo "Ensuring production superadmin exists..."
./node_modules/.bin/ts-node prisma/seed.ts

echo "Starting PayHarness API..."
exec node dist/main.js
