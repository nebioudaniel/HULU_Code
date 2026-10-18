-- Projects sync schema.
-- Applied with: psql "$DATABASE_URL" -f migrations/003_projects.sql

CREATE TABLE IF NOT EXISTS projects (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  root_hash      TEXT NOT NULL,
  file_count     INTEGER NOT NULL DEFAULT 0,
  chunk_count    INTEGER NOT NULL DEFAULT 0,
  edge_count     INTEGER NOT NULL DEFAULT 0,
  languages      JSONB NOT NULL DEFAULT '{}',
  external_deps  JSONB NOT NULL DEFAULT '[]',
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, root_hash)
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx ON projects (user_id);
CREATE INDEX IF NOT EXISTS projects_last_synced_idx ON projects (last_synced_at);

CREATE TABLE IF NOT EXISTS project_files (
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  path       TEXT NOT NULL,
  language   TEXT NOT NULL,
  line_count INTEGER NOT NULL DEFAULT 0,
  partial    BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (project_id, path)
);

CREATE INDEX IF NOT EXISTS project_files_project_id_idx ON project_files (project_id);

CREATE TABLE IF NOT EXISTS code_chunks (
  project_id    UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  chunk_key     TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  language      TEXT NOT NULL,
  kind          TEXT NOT NULL,
  name          TEXT NOT NULL DEFAULT '',
  parent        TEXT NOT NULL DEFAULT '',
  start_line    INTEGER NOT NULL DEFAULT 0,
  end_line      INTEGER NOT NULL DEFAULT 0,
  content_hash  TEXT NOT NULL DEFAULT '',
  uses_goroutines BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (project_id, chunk_key)
);

CREATE INDEX IF NOT EXISTS code_chunks_project_id_idx ON code_chunks (project_id);
CREATE INDEX IF NOT EXISTS code_chunks_file_path_idx ON code_chunks (project_id, file_path);

CREATE TABLE IF NOT EXISTS project_edges (
  project_id UUID NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  from_path  TEXT NOT NULL,
  to_path    TEXT NOT NULL,
  PRIMARY KEY (project_id, from_path, to_path)
);

CREATE INDEX IF NOT EXISTS project_edges_project_id_idx ON project_edges (project_id);
