import type { PoolClient } from "@neondatabase/serverless";

import { pool } from "@/lib/db";
import { getPlanLabel, getPlanLimits } from "@/lib/plans";

const MAX_CHUNKS = 50_000;
const MAX_FILES = 20_000;
const MAX_EDGES = 200_000;
const MAX_NAME = 80;
const MAX_PATH = 500;
const MAX_FIELD = 200;
const MAX_ROOT_HASH = 128;
const INSERT_BATCH = 1_000;
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

async function insertRows(
  client: Client,
  table: string,
  columns: string[],
  rows: unknown[][]
): Promise<void> {
  for (let start = 0; start < rows.length; start += INSERT_BATCH) {
    const slice = rows.slice(start, start + INSERT_BATCH);
    const values: unknown[] = [];
    const groups = slice.map((row) => {
      const placeholders = row.map((value) => {
        values.push(value);
        return `$${values.length}`;
      });
      return `(${placeholders.join(",")})`;
    });
    await client.query(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES ${groups.join(",")}`,
      values
    );
  }
}

export async function syncProject(
  userId: string,
  tier: string | null | undefined,
  payload: SyncPayload
): Promise<SyncOutcome> {
  const limits = getPlanLimits(tier);
  const plan = getPlanLabel(tier);
  const client = (await pool.connect()) as unknown as PoolClient;

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT id, chunk_count FROM projects WHERE user_id = $1 AND root_hash = $2",
      [userId, payload.project.root_hash]
    );
    const existingRow = existing.rows[0];

    const projectsResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM projects WHERE user_id = $1",
      [userId]
    );
    const currentProjects = (projectsResult.rows[0]?.count as number) ?? 0;
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

    const chunksResult = await client.query(
      "SELECT COALESCE(SUM(chunk_count), 0)::int AS total FROM projects WHERE user_id = $1",
      [userId]
    );
    const currentChunks = (chunksResult.rows[0]?.total as number) ?? 0;
    const previousChunks = (existingRow?.chunk_count as number) ?? 0;
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
    const projectId = upsert.rows[0].id as string;

    await client.query("DELETE FROM project_files WHERE project_id = $1", [projectId]);
    await client.query("DELETE FROM code_chunks WHERE project_id = $1", [projectId]);
    await client.query("DELETE FROM project_edges WHERE project_id = $1", [projectId]);

    await insertRows(
      client,
      "project_files",
      ["project_id", "path", "language", "line_count", "partial"],
      payload.files.map((file) => [projectId, file.path, file.language, file.line_count, file.partial])
    );
    await insertRows(
      client,
      "code_chunks",
      [
        "project_id",
        "chunk_key",
        "file_path",
        "language",
        "kind",
        "name",
        "parent",
        "start_line",
        "end_line",
        "content_hash",
        "uses_goroutines",
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
    await insertRows(
      client,
      "project_edges",
      ["project_id", "from_path", "to_path"],
      payload.edges.map((edge) => [projectId, edge.from, edge.to])
    );

    await client.query("COMMIT");

    return {
      ok: true,
      projectId,
      files: payload.files.length,
      chunks: payload.chunks.length,
      edges: payload.edges.length,
    };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      void 0;
    }
    return { ok: false, status: 500, error: "Could not save the project. Please try again." };
  } finally {
    client.release();
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
