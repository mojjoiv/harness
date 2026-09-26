#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be set}"

echo "Starting PayHarness API..."
exec node dist/main.js
