-- AI features tables and columns.
-- Applied with: psql "$DATABASE_URL" -f migrations/007_ai_features.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ai_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  input_hash TEXT,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_events_user_id_idx ON ai_events (user_id);
CREATE INDEX IF NOT EXISTS ai_events_project_id_idx ON ai_events (project_id);
CREATE INDEX IF NOT EXISTS ai_events_created_at_idx ON ai_events (created_at);