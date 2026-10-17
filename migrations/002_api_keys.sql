-- API keys table.
-- Mirrors the structure already present in the live database, so this is a
-- no-op there. The only change applied to an existing table is the user_id index.
-- Applied with:  psql "$DATABASE_URL" -f migrations/002_api_keys.sql

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID,
  name         TEXT,
  key_prefix   TEXT,
  key_hash     TEXT NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
