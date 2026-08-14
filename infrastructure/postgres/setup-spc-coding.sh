#!/bin/bash
set -euo pipefail

# Configuration
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_PASSWORD:?Must set POSTGRES_PASSWORD}"
: "${POSTGRES_USER:?Must set POSTGRES_USER}"
: "${SPC_POSTGRES_PASSWORD:?Must set SPC_POSTGRES_PASSWORD}"
: "${SPC_POSTGRES_USER:?Must set SPC_POSTGRES_USER}"
: "${KEEP_ALIVE_SECONDS:=0}"

TARGET_DB=${TARGET_DB-"events"}
export TARGET_DB=${TARGET_DB//-/_}

echo "Waiting for PostgreSQL to be ready at ${POSTGRES_HOST}:${POSTGRES_PORT}..."
until PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" -d postgres -c '\q' 2>/dev/null; do
  sleep 2
done

sleep "$KEEP_ALIVE_SECONDS"

create_or_update_role() {
  local role=$1
  local password=$2
  local db=$3

  PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" -d postgres <<EOSQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', '${role}', '${password}');
  ELSE
    EXECUTE format('ALTER ROLE %I WITH PASSWORD %L', '${role}', '${password}');
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO %I', '${db}', '${role}');
END
\$\$;
EOSQL
}

create_or_update_role "$SPC_POSTGRES_USER" "$SPC_POSTGRES_PASSWORD" "$TARGET_DB"

# Schema + table + grants
PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
  -U "$POSTGRES_USER" -d "$TARGET_DB" <<EOSQL

CREATE SCHEMA IF NOT EXISTS spc;

CREATE TABLE IF NOT EXISTS spc.coding (
  tracking_id TEXT PRIMARY KEY,
  status TEXT,
  uc_code TEXT,
  selected_codes TEXT,
  multiple_codes TEXT,
  free_text TEXT,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_by_system TIMESTAMPTZ NULL
);

-- Records of death registrations that failed to reach the SPC portal, retried
-- until they succeed or are manually discarded. A row is deleted once its
-- retry succeeds; see src/api/spc-coding/retryQueue.ts.
CREATE TABLE IF NOT EXISTS spc.outbound_retry_queue (
  event_id TEXT PRIMARY KEY,
  tracking_id TEXT,
  payload TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 1,
  last_error TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT USAGE ON SCHEMA spc TO "$SPC_POSTGRES_USER";

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA spc TO "$SPC_POSTGRES_USER";

EOSQL

echo "✅ SPC schema initialized for database '$TARGET_DB'"