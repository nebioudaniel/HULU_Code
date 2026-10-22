-- Start Here Guide tables.
-- Applied with: psql "$DATABASE_URL" -f migrations/006_start_here.sql

-- project_meta: stores manifest and optional README per project
CREATE TABLE IF NOT EXISTS project_meta (
  project_id UUID PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
  manifest JSONB NOT NULL DEFAULT '{}',
  readme TEXT,
  readme_updated_at TIMESTAMPTZ
);

-- project_guides: stores deterministic and AI-generated guides
CREATE TABLE IF NOT EXISTS project_guides (
  project_id UUID PRIMARY KEY REFERENCES projects (id) ON DELETE CASCADE,
  ranking JSONB,                    -- deterministic ranked file list with scores
  guide JSONB,                      -- {what_for, modules[], reading_list[], flow, careful[]}
  source TEXT NOT NULL DEFAULT 'deterministic',  -- 'deterministic' or 'deepseek'
  include_readme BOOLEAN NOT NULL DEFAULT false,
  input_hash TEXT NOT NULL,         -- hash of (last_synced_at, file_count, edge_count, include_readme)
  model TEXT,                       -- model name for AI-generated guides
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- index for finding stale guides
CREATE INDEX IF NOT EXISTS project_guides_input_hash_idx ON project_guides (input_hash);