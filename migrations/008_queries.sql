-- Queries table for AI questions.
-- Applied with: psql "$DATABASE_URL" -f migrations/008_queries.sql

CREATE TABLE IF NOT EXISTS queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects (id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer JSONB,
  files JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS queries_user_id_idx ON queries (user_id);
CREATE INDEX IF NOT EXISTS queries_project_id_idx ON queries (project_id);
CREATE INDEX IF NOT EXISTS queries_created_at_idx ON queries (user_id, created_at DESC);