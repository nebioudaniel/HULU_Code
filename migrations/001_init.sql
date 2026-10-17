-- huluCode initial schema.
-- Only columns that are referenced by real queries in the codebase are created.
-- Applied with:  psql "$DATABASE_URL" -f migrations/001_init.sql

CREATE TABLE IF NOT EXISTS users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  github_id    BIGINT NOT NULL UNIQUE,
  email        TEXT,
  name         TEXT,
  avatar_url   TEXT,
  plan_tier    TEXT NOT NULL DEFAULT 'free',
  plan_ends_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  tx_ref          TEXT NOT NULL UNIQUE,
  amount          NUMERIC(10, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'ETB',
  status          TEXT NOT NULL DEFAULT 'pending',
  chapa_reference TEXT,
  channel         TEXT NOT NULL DEFAULT 'hosted',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments (user_id);
