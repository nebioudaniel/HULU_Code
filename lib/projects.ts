import type { PoolClient } from "@neondatabase/serverless";

import { pool, createPool } from "@/lib/db";
import { getPlanLabel, getPlanLimits } from "@/lib/plans";
import { logError } from "@/lib/errors";

const MAX_CHUNKS = 50_000;
const MAX_FILES = 20_000;
const MAX_EDGES = 200_000;
const MAX_NAME = 80;
const MAX_PATH = 500;
const MAX_FIELD = 200;
const MAX_ROOT_HASH = 128;
const ROOT_HASH = /^[a-f0-9]{16,128}$/;

type Client = PoolClient;

export type SyncFileInput = {
  path: string;
  language: string;
  line_count: number;
  partial: boolean;
};

export type SyncChunkInput = {
  key: string;
  file_path: string;
  language: string;
  kind: string;
  name: string;
  parent: string;
  start_line: number;
  end_line: number;
  content_hash: string;
  uses_goroutines: boolean;
};

export type SyncEdgeInput = { from: string; to: string };

export type SyncExternalInput = { name: string; count: number };

export type SyncPayload = {
  project: { name: string; root_hash: string };
  files: SyncFileInput[];
  chunks: SyncChunkInput[];
  edges: SyncEdgeInput[];
  external_dependencies: SyncExternalInput[];
  cli_version: string;
};

export type ParseResult =
  | { ok: true; payload: SyncPayload }
  | { ok: false; error: string };

export type SyncOutcome =
  | { ok: true; projectId: string; files: number; chunks: number; edges: number }
  | { ok: false; status: number; error: string; limit?: number; used?: number; plan?: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

function isStr(value: unknown): value is string {
  return typeof value === "string";
}

function isRelativePath(value: string): boolean {
  if (value.length < 1 || value.length > MAX_PATH || value.startsWith("/")) {
    return false;
  }
  if (value.includes("\\") || value.includes("\u0000")) {
    return false;
  }
  return value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

function bad(error: string): { ok: false; error: string } {
  return { ok: false, error };
}

function parseFiles(raw: unknown): { ok: true; files: SyncFileInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return bad("files must be an array.");
  }
  if (raw.length > MAX_FILES) {
    return bad(`Too many files (max ${MAX_FILES}).`);
  }

  const files: SyncFileInput[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isObject(item)) {
      return bad(`files[${i}] must be an object.`);
    }
    const path = item.path;
    if (!isStr(path) || !isRelativePath(path)) {
      return bad(`files[${i}].path must be a relative path.`);
    }
    if (seen.has(path)) {
      return bad(`Duplicate file path: ${path}`);
    }
    seen.add(path);

    const language = item.language;
    if (!isStr(language) || language.length < 1 || language.length > MAX_FIELD) {
      return bad(`files[${i}].language is invalid.`);
    }
    const lineCount = item.line_count;
    if (!isInt(lineCount) || lineCount < 0) {
      return bad(`files[${i}].line_count is invalid.`);
    }
    const partial = item.partial;
    if (typeof partial !== "boolean") {
      return bad(`files[${i}].partial must be a boolean.`);
    }

    files.push({ path, language, line_count: lineCount, partial });
  }

  return { ok: true, files };
}

function parseChunks(
  raw: unknown,
  filePaths: Set<string>
): { ok: true; chunks: SyncChunkInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return bad("chunks must be an array.");
  }
  if (raw.length > MAX_CHUNKS) {
    return bad(`Too many chunks (max ${MAX_CHUNKS}).`);
  }

  const chunks: SyncChunkInput[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isObject(item)) {
      return bad(`chunks[${i}] must be an object.`);
    }
    const key = item.key;
    if (!isStr(key) || key.length < 1 || key.length > 64) {
      return bad(`chunks[${i}].key is invalid.`);
    }
    if (seen.has(key)) {
      return bad(`Duplicate chunk key: ${key}`);
    }
    seen.add(key);

    const filePath = item.file_path;
    if (!isStr(filePath) || !filePaths.has(filePath)) {
      return bad(`chunks[${i}].file_path does not match a synced file.`);
    }
    const language = item.language;
    if (!isStr(language) || language.length < 1 || language.length > MAX_FIELD) {
      return bad(`chunks[${i}].language is invalid.`);
    }
    const kind = item.kind;
    if (!isStr(kind) || kind.length < 1 || kind.length > MAX_FIELD) {
      return bad(`chunks[${i}].kind is invalid.`);
    }
    const name = item.name ?? "";
    if (!isStr(name) || name.length > MAX_FIELD) {
      return bad(`chunks[${i}].name is invalid.`);
    }
    const parent = item.parent ?? "";
    if (!isStr(parent) || parent.length > MAX_FIELD) {
      return bad(`chunks[${i}].parent is invalid.`);
    }
    const startLine = item.start_line;
    if (!isInt(startLine) || startLine < 1) {
      return bad(`chunks[${i}].start_line is invalid.`);
    }
    const endLine = item.end_line;
    if (!isInt(endLine) || endLine < startLine) {
      return bad(`chunks[${i}].end_line is invalid.`);
    }
    const contentHash = item.content_hash ?? "";
    if (!isStr(contentHash) || contentHash.length > 64) {
      return bad(`chunks[${i}].content_hash is invalid.`);
    }
    const usesGoroutines = item.uses_goroutines ?? false;
    if (typeof usesGoroutines !== "boolean") {
      return bad(`chunks[${i}].uses_goroutines must be a boolean.`);
    }

    chunks.push({
      key,
      file_path: filePath,
      language,
      kind,
      name,
      parent,
      start_line: startLine,
      end_line: endLine,
      content_hash: contentHash,
      uses_goroutines: usesGoroutines,
    });
  }

  return { ok: true, chunks };
}

function parseEdges(
  raw: unknown,
  filePaths: Set<string>
): { ok: true; edges: SyncEdgeInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return bad("edges must be an array.");
  }
  if (raw.length > MAX_EDGES) {
    return bad(`Too many edges (max ${MAX_EDGES}).`);
  }

  const edges: SyncEdgeInput[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isObject(item)) {
      return bad(`edges[${i}] must be an object.`);
    }
    const from = item.from;
    const to = item.to;
    if (!isStr(from) || !filePaths.has(from)) {
      return bad(`edges[${i}].from does not match a synced file.`);
    }
    if (!isStr(to) || !filePaths.has(to)) {
      return bad(`edges[${i}].to does not match a synced file.`);
    }
    const dedupe = `${from}\u0000${to}`;
    if (seen.has(dedupe)) {
      continue;
    }
    seen.add(dedupe);
    edges.push({ from, to });
  }

  return { ok: true, edges };
}

function parseExternal(
  raw: unknown
): { ok: true; external: SyncExternalInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw)) {
    return bad("external_dependencies must be an array.");
  }

  const external: SyncExternalInput[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!isObject(item)) {
      return bad(`external_dependencies[${i}] must be an object.`);
    }
    const name = item.name;
    if (!isStr(name) || name.length < 1 || name.length > MAX_FIELD) {
      return bad(`external_dependencies[${i}].name is invalid.`);
    }
    const count = item.count;
    if (!isInt(count) || count < 0) {
      return bad(`external_dependencies[${i}].count is invalid.`);
    }
    external.push({ name, count });
  }

  return { ok: true, external };
}

export function parseSyncPayload(value: unknown): ParseResult {
  if (!isObject(value)) {
    return bad("Body must be a JSON object.");
  }

  const project = value.project;
  if (!isObject(project)) {
    return bad("Missing project.");
  }
  const rawName = project.name;
  if (!isStr(rawName)) {
    return bad("project.name must be a string.");
  }
  const name = rawName.trim();
  if (name.length < 1 || name.length > MAX_NAME) {
    return bad(`project.name must be between 1 and ${MAX_NAME} characters.`);
  }
  const rootHash = project.root_hash;
  if (!isStr(rootHash) || rootHash.length > MAX_ROOT_HASH || !ROOT_HASH.test(rootHash)) {
    return bad("project.root_hash must be a lowercase hex string.");
  }

  const filesResult = parseFiles(value.files);
  if (!filesResult.ok) {
    return filesResult;
  }
  const filePaths = new Set(filesResult.files.map((file) => file.path));

  const chunksResult = parseChunks(value.chunks, filePaths);
  if (!chunksResult.ok) {
    return chunksResult;
  }
  const edgesResult = parseEdges(value.edges, filePaths);
  if (!edgesResult.ok) {
    return edgesResult;
  }
  const externalResult = parseExternal(value.external_dependencies);
  if (!externalResult.ok) {
    return externalResult;
  }

  const rawVersion = value.cli_version;
  if (rawVersion !== undefined && (!isStr(rawVersion) || rawVersion.length > 40)) {
    return bad("cli_version is invalid.");
  }

  return {
    ok: true,
    payload: {
      project: { name, root_hash: rootHash },
      files: filesResult.files,
      chunks: chunksResult.chunks,
      edges: edgesResult.edges,
      external_dependencies: externalResult.external,
      cli_version: isStr(rawVersion) ? rawVersion : "",
    },
  };
}

function countLanguages(files: SyncFileInput[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    counts[file.language] = (counts[file.language] ?? 0) + 1;
  }
  return counts;
}

type ColumnDef = { name: string; cast: string };

async function insertRows(
  client: Client,
  table: string,
  columns: ColumnDef[],
  rows: unknown[][]
): Promise<void> {
  if (rows.length === 0) {
    return;
  }
  const columnList = columns.map((c) => c.name).join(", ");
  const unnestArgs = columns.map((_, i) => `$${i + 1}::${columns[i].cast}[]`).join(", ");
  const params = columns.map((_, i) => rows.map((row) => row[i]));
  await client.query(
    `INSERT INTO ${table} (${columnList}) SELECT * FROM unnest(${unnestArgs})`,
    params
  );
}

export async function syncProject(
  userId: string,
  tier: string | null | undefined,
  payload: SyncPayload
): Promise<SyncOutcome> {
  const limits = getPlanLimits(tier);
  const plan = getPlanLabel(tier);
  const dbPool = await createPool();
  const client = (await dbPool.connect()) as unknown as PoolClient;

  try {
    await client.query("BEGIN");

    let existingRow: { id: string; chunk_count: number } | undefined;
    let currentProjects = 0;
    let currentChunks = 0;

    try {
      const existing = await client.query(
        "SELECT id, chunk_count, (SELECT COUNT(*)::int FROM projects WHERE user_id = $1) AS project_count, (SELECT COALESCE(SUM(chunk_count), 0)::int FROM projects WHERE user_id = $1) AS total_chunks FROM projects WHERE user_id = $1 AND root_hash = $2",
        [userId, payload.project.root_hash]
      );
      const row = existing.rows[0];
      if (row) {
        existingRow = { id: row.id as string, chunk_count: row.chunk_count as number };
        currentProjects = row.project_count as number;
        currentChunks = row.total_chunks as number;
      } else {
        const counts = await client.query(
          "SELECT COUNT(*)::int AS project_count, COALESCE(SUM(chunk_count), 0)::int AS total_chunks FROM projects WHERE user_id = $1",
          [userId]
        );
        currentProjects = (counts.rows[0]?.project_count as number) ?? 0;
        currentChunks = (counts.rows[0]?.total_chunks as number) ?? 0;
      }
    } catch (error) {
      logError("sync", error, "plan limits");
      throw error;
    }

    const nextProjects = existingRow ? currentProjects : currentProjects + 1;

    if (nextProjects > limits.projects) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        status: 403,
        error: `Your plan allows ${limits.projects} projects. Upgrade to sync more.`,
        limit: limits.projects,
        used: nextProjects,
        plan,
      };
    }

    const previousChunks = existingRow?.chunk_count ?? 0;
    const nextChunks = currentChunks - previousChunks + payload.chunks.length;

    if (nextChunks > limits.chunks) {
      await client.query("ROLLBACK");
      return {
        ok: false,
        status: 403,
        error: `Your plan allows ${limits.chunks} chunks. Upgrade to sync more.`,
        limit: limits.chunks,
        used: nextChunks,
        plan,
      };
    }

    let projectId: string;
    try {
      const upsert = await client.query(
        `INSERT INTO projects (user_id, name, root_hash, file_count, chunk_count, edge_count, languages, external_deps, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, now())
         ON CONFLICT (user_id, root_hash) DO UPDATE SET
           name = EXCLUDED.name,
           file_count = EXCLUDED.file_count,
           chunk_count = EXCLUDED.chunk_count,
           edge_count = EXCLUDED.edge_count,
           languages = EXCLUDED.languages,
           external_deps = EXCLUDED.external_deps,
           last_synced_at = now()
         RETURNING id`,
        [
          userId,
          payload.project.name,
          payload.project.root_hash,
          payload.files.length,
          payload.chunks.length,
          payload.edges.length,
          JSON.stringify(countLanguages(payload.files)),
          JSON.stringify(payload.external_dependencies),
        ]
      );
      projectId = upsert.rows[0].id as string;
    } catch (error) {
      logError("sync", error, "upsert project");
      throw error;
    }

    try {
      await client.query("DELETE FROM project_files WHERE project_id = $1; DELETE FROM code_chunks WHERE project_id = $1; DELETE FROM project_edges WHERE project_id = $1", [projectId]);
    } catch (error) {
      logError("sync", error, "replace files");
      throw error;
    }

    try {
      await insertRows(
        client,
        "project_files",
        [
          { name: "project_id", cast: "text" },
          { name: "path", cast: "text" },
          { name: "language", cast: "text" },
          { name: "line_count", cast: "int" },
          { name: "partial", cast: "boolean" },
        ],
        payload.files.map((file) => [projectId, file.path, file.language, file.line_count, file.partial])
      );
    } catch (error) {
      logError("sync", error, "replace files");
      throw error;
    }

    try {
      await insertRows(
        client,
        "code_chunks",
        [
          { name: "project_id", cast: "text" },
          { name: "chunk_key", cast: "text" },
          { name: "file_path", cast: "text" },
          { name: "language", cast: "text" },
          { name: "kind", cast: "text" },
          { name: "name", cast: "text" },
          { name: "parent", cast: "text" },
          { name: "start_line", cast: "int" },
          { name: "end_line", cast: "int" },
          { name: "content_hash", cast: "text" },
          { name: "uses_goroutines", cast: "boolean" },
        ],
        payload.chunks.map((chunk) => [
          projectId,
          chunk.key,
          chunk.file_path,
          chunk.language,
          chunk.kind,
          chunk.name,
          chunk.parent,
          chunk.start_line,
          chunk.end_line,
          chunk.content_hash,
          chunk.uses_goroutines,
        ])
      );
    } catch (error) {
      logError("sync", error, "replace chunks");
      throw error;
    }

    try {
      await insertRows(
        client,
        "project_edges",
        [
          { name: "project_id", cast: "text" },
          { name: "from_path", cast: "text" },
          { name: "to_path", cast: "text" },
        ],
        payload.edges.map((edge) => [projectId, edge.from, edge.to])
      );
    } catch (error) {
      logError("sync", error, "replace edges");
      throw error;
    }

    try {
      await client.query("COMMIT");
    } catch (error) {
      logError("sync", error, "commit");
      throw error;
    }

    return {
      ok: true,
      projectId,
      files: payload.files.length,
      chunks: payload.chunks.length,
      edges: payload.edges.length,
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      void 0;
    }
    const code = (error as { code?: string })?.code;
    if (code === "42P01") {
      return { ok: false, status: 503, error: "The database is not set up for projects yet. Run migrations/003_projects.sql." };
    }
    logError("sync", error, "upsert project");
    return { ok: false, status: 500, error: "Could not save the project. Please try again." };
  } finally {
    client.release();
    if (typeof dbPool.end === "function") {
      await dbPool.end();
    }
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProjectId(value: string): boolean {
  return UUID.test(value);
}

export async function deleteProject(userId: string, projectId: string): Promise<boolean> {
  const result = await pool.query(
    "DELETE FROM projects WHERE id = $1 AND user_id = $2",
    [projectId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export type ProjectSummary = {
  id: string;
  name: string;
  fileCount: number;
  chunkCount: number;
  edgeCount: number;
  languages: Record<string, number>;
  externalDependencies: SyncExternalInput[];
  lastSyncedAt: string | null;
  createdAt: string | null;
};

export type ProjectFileRow = {
  path: string;
  language: string;
  lineCount: number;
  partial: boolean;
  chunkCount: number;
};

export type ProjectChunkRow = {
  key: string;
  filePath: string;
  kind: string;
  name: string;
  parent: string;
  startLine: number;
  endLine: number;
};

const PROJECT_COLUMNS =
  "id, name, file_count, chunk_count, edge_count, languages, external_deps, last_synced_at, created_at";

function toSummary(row: Record<string, unknown>): ProjectSummary {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    fileCount: Number(row.file_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    edgeCount: Number(row.edge_count ?? 0),
    languages: (row.languages as Record<string, number>) ?? {},
    externalDependencies: Array.isArray(row.external_deps)
      ? (row.external_deps as SyncExternalInput[])
      : [],
    lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
  };
}

export async function listProjects(userId: string): Promise<ProjectSummary[]> {
  try {
    const { rows } = await pool.query(
      `SELECT ${PROJECT_COLUMNS} FROM projects
        WHERE user_id = $1
        ORDER BY last_synced_at DESC NULLS LAST, created_at DESC`,
      [userId]
    );
    return rows.map(toSummary);
  } catch {
    return [];
  }
}

export async function getProject(
  userId: string,
  projectId: string
): Promise<ProjectSummary | null> {
  try {
    const { rows } = await pool.query(
      `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1 AND user_id = $2`,
      [projectId, userId]
    );
    return rows[0] ? toSummary(rows[0]) : null;
  } catch {
    return null;
  }
}

export async function projectTotals(
  userId: string
): Promise<{ projects: number; chunks: number }> {
  try {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS projects, COALESCE(SUM(chunk_count), 0)::int AS chunks
         FROM projects WHERE user_id = $1`,
      [userId]
    );
    return {
      projects: Number(rows[0]?.projects ?? 0),
      chunks: Number(rows[0]?.chunks ?? 0),
    };
  } catch {
    return { projects: 0, chunks: 0 };
  }
}

export async function countProjectFiles(projectId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS count FROM project_files WHERE project_id = $1",
      [projectId]
    );
    return Number(rows[0]?.count ?? 0);
  } catch {
    return 0;
  }
}

export async function listProjectFiles(
  projectId: string,
  limit: number,
  offset: number
): Promise<ProjectFileRow[]> {
  try {
    const { rows } = await pool.query(
      `SELECT f.path, f.language, f.line_count, f.partial, COUNT(c.chunk_key)::int AS chunk_count
         FROM project_files f
         LEFT JOIN code_chunks c ON c.project_id = f.project_id AND c.file_path = f.path
        WHERE f.project_id = $1
        GROUP BY f.path, f.language, f.line_count, f.partial
        ORDER BY f.path
        LIMIT $2 OFFSET $3`,
      [projectId, limit, offset]
    );
    return rows.map((row) => ({
      path: String(row.path),
      language: String(row.language ?? ""),
      lineCount: Number(row.line_count ?? 0),
      partial: Boolean(row.partial),
      chunkCount: Number(row.chunk_count ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function listProjectChunks(
  projectId: string,
  paths: string[]
): Promise<ProjectChunkRow[]> {
  if (paths.length === 0) {
    return [];
  }

  try {
    const { rows } = await pool.query(
      `SELECT chunk_key, file_path, kind, name, parent, start_line, end_line
         FROM code_chunks
        WHERE project_id = $1 AND file_path = ANY($2::text[])
        ORDER BY file_path, start_line, name`,
      [projectId, paths]
    );
    return rows.map((row) => ({
      key: String(row.chunk_key),
      filePath: String(row.file_path),
      kind: String(row.kind ?? ""),
      name: String(row.name ?? ""),
      parent: String(row.parent ?? ""),
      startLine: Number(row.start_line ?? 0),
      endLine: Number(row.end_line ?? 0),
    }));
  } catch {
    return [];
  }
}

export type ProjectEdgeRow = {
  fromPath: string;
  toPath: string;
};

export async function listProjectEdges(
  projectId: string,
  limit: number
): Promise<ProjectEdgeRow[]> {
  try {
    const { rows } = await pool.query(
      `SELECT from_path, to_path
         FROM project_edges
        WHERE project_id = $1
        ORDER BY from_path, to_path
        LIMIT $2`,
      [projectId, limit]
    );
    return rows.map((row) => ({
      fromPath: String(row.from_path),
      toPath: String(row.to_path),
    }));
  } catch {
    return [];
  }
}
