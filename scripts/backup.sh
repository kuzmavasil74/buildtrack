#!/usr/bin/env bash
# Dumps both databases to ./backups/<timestamp>/ :
#   postgres.sql     users, sites, crews, password-reset tokens   (pg_dump)
#   mongo/           daily records and receipts                   (mongodump)
#
# Usage:  DATABASE_URL=... MONGO_URI=... ./scripts/backup.sh
# Needs the PostgreSQL client tools and MongoDB Database Tools on the PATH.
# The Railway Postgres is only reachable from outside through a temporary TCP
# proxy (see README, "Backups"); the connection URL must be the public one.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to the Postgres connection URL}"
: "${MONGO_URI:?Set MONGO_URI to the MongoDB connection string}"

out="backups/$(date +%Y%m%d-%H%M%S)"
umask 077
mkdir -p "$out"

echo "Dumping Postgres..."
pg_dump "$DATABASE_URL" --no-owner --no-privileges --file "$out/postgres.sql"

echo "Dumping MongoDB..."
mongodump --uri "$MONGO_URI" --out "$out/mongo" --quiet

echo "Backup written to $out"
du -sh "$out"
