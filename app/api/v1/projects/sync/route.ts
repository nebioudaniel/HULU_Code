import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

import { verifyApiKey } from "@/lib/api-keys";
import { hashApiKey } from "@/lib/api-key-hash";
import { parseSyncPayload, syncProject } from "@/lib/projects";
import { getPlanLimits } from "@/lib/plans";
import { logError } from "@/lib/errors";
import { createPool } from "@/lib/db";

const BEARER_PREFIX = "Bearer ";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(req: Request) {
  const header = req.headers.get("authorization");

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const rawKey = header.slice(BEARER_PREFIX.length).trim();
  const SYNC_MAX_BYTES = Number(process.env.SYNC_MAX_BYTES ?? 1500000);

  let body: unknown;
  try {
    const encoding = (req.headers.get("content-encoding") ?? "").toLowerCase();
    const stream =
      encoding.includes("gzip") && req.body
        ? req.body.pipeThrough(new DecompressionStream("gzip"))
        : req.body;

    if (!stream) {
      return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
    }

    const reader = stream.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > SYNC_MAX_BYTES) {
        return NextResponse.json(
          { error: "Project is too large to sync. Try running the sync from a subfolder." },
          { status: 413 }
        );
      }
      chunks.push(value);
    }

    const buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder().decode(buffer);
    body = JSON.parse(text);
  } catch (error) {
    logError("sync", error, "read body");
    const code = (error as { code?: string })?.code;
    if (code === "ERR_BUFFER_TOO_LARGE") {
      return NextResponse.json(
        { error: "Project is too large to sync. Try running the sync from a subfolder." },
        { status: 413 }
      );
    }
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });
  }

  const phase = (body as { phase?: unknown }).phase;

  const useHttp = process.env.DB_DRIVER !== "pg";

  let auth: { ok: true; userId: string; planTier: string | null } | { ok: false; error: string; status: number };
  try {
    if (useHttp) {
      const sql = neon(process.env.DATABASE_URL!);
      const keyHash = hashApiKey(rawKey);
      const rows = await sql`SELECT k.user_id, k.revoked_at, u.plan_tier FROM api_keys k JOIN users u ON k.user_id = u.id WHERE k.key_hash = ${keyHash}`;
      const row = rows[0];
      if (!row) {
        auth = { ok: false, error: "Invalid API key", status: 401 };
      } else if (row.revoked_at) {
        auth = { ok: false, error: "API key has been revoked", status: 401 };
      } else {
        auth = { ok: true, userId: row.user_id as string, planTier: row.plan_tier as string | null };
      }
    } else {
      const verified = await verifyApiKey(rawKey);
      if (verified.ok) {
        auth = { ok: true, userId: verified.userId, planTier: verified.planTier };
      } else {
        auth = { ok: false, error: verified.error, status: verified.status };
      }
    }
  } catch (error) {
    logError("sync", error, "validate");
    return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
  }

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (phase === "batch" || phase === "commit") {
    const project = (body as { project?: unknown }).project;
    if (typeof project !== "object" || project === null || Array.isArray(project)) {
      return NextResponse.json({ error: "Missing project." }, { status: 400 });
    }
    const projectName = (project as { name?: unknown }).name;
    const rootHash = (project as { root_hash?: unknown }).root_hash;
    if (typeof projectName !== "string" || projectName.trim().length < 1) {
      return NextResponse.json({ error: "project.name must be a string." }, { status: 400 });
    }
    if (typeof rootHash !== "string" || rootHash.length < 1) {
      return NextResponse.json({ error: "project.root_hash must be a string." }, { status: 400 });
    }

    const syncId = (body as { sync_id?: unknown }).sync_id;
    if (typeof syncId !== "string" || !isUuid(syncId)) {
      return NextResponse.json({ error: "sync_id must be a uuid." }, { status: 400 });
    }

    const totals = (body as { totals?: unknown }).totals;
    if (typeof totals !== "object" || totals === null || Array.isArray(totals)) {
      return NextResponse.json({ error: "totals must be an object." }, { status: 400 });
    }
    const totalFiles = (totals as { files?: unknown }).files;
    const totalChunks = (totals as { chunks?: unknown }).chunks;
    const totalEdges = (totals as { edges?: unknown }).edges;
    if (typeof totalFiles !== "number" || typeof totalChunks !== "number" || typeof totalEdges !== "number") {
      return NextResponse.json({ error: "totals are invalid." }, { status: 400 });
    }

    if (phase === "batch") {
      const files = (body as { files?: unknown }).files;
      const chunks = (body as { chunks?: unknown }).chunks;
      const edges = (body as { edges?: unknown }).edges;

      const fileList = Array.isArray(files) ? files : [];
      const chunkList = Array.isArray(chunks) ? chunks : [];
      const edgeList = Array.isArray(edges) ? edges : [];
      const typedFiles = fileList as Array<{ path: string; language: string; line_count: number; partial: boolean }>;
      const typedChunks = chunkList as Array<{ key: string; file_path: string; language: string; kind: string; name?: string; parent?: string; start_line: number; end_line: number; content_hash?: string; uses_goroutines?: boolean }>;
      const typedEdges = edgeList as Array<{ from: string; to: string }>;

      if (fileList.length > 200 || chunkList.length > 150 || edgeList.length > 300) {
        return NextResponse.json(
          { error: "Project is too large to sync. Try running the sync from a subfolder." },
          { status: 413 }
        );
      }

      try {
        if (useHttp) {
          const sql = neon(process.env.DATABASE_URL!);
          const existing = await sql`SELECT id, chunk_count FROM projects WHERE user_id = ${auth.userId} AND root_hash = ${rootHash}`;
          const existingRow = existing[0];
          const isNew = !existingRow;

          if (isNew) {
            const countRows = await sql`SELECT COUNT(*)::int AS count FROM projects WHERE user_id = ${auth.userId}`;
            const currentProjects = Number(countRows[0]?.count ?? 0);
            const limits = getPlanLimits(auth.planTier);
            if (currentProjects + 1 > limits.projects) {
              return NextResponse.json(
                { error: `Your plan allows ${limits.projects} projects. Upgrade to sync more.` },
                { status: 403 }
              );
            }
          }

          const chunkRows = await sql`SELECT COALESCE(SUM(chunk_count), 0)::int AS total FROM projects WHERE user_id = ${auth.userId}`;
          const currentChunks = Number(chunkRows[0]?.total ?? 0);
          const previousChunks = existingRow ? Number(existingRow.chunk_count ?? 0) : 0;
          const limits = getPlanLimits(auth.planTier);
          if (currentChunks - previousChunks + totalChunks > limits.chunks) {
            return NextResponse.json(
              { error: `Your plan allows ${limits.chunks} chunks. Upgrade to sync more.` },
              { status: 403 }
            );
          }

          const upsert = await sql`INSERT INTO projects (user_id, name, root_hash, file_count, chunk_count, edge_count, languages, external_deps, last_synced_at) VALUES (${auth.userId}, ${projectName.trim()}, ${rootHash}, 0, 0, 0, '{}'::jsonb, '[]'::jsonb, now()) ON CONFLICT (user_id, root_hash) DO UPDATE SET name = EXCLUDED.name RETURNING id`;
          const projectId = upsert[0].id as string;

          if (fileList.length > 0) {
            const paths = typedFiles.map(f => f.path);
            const languages = typedFiles.map(f => f.language);
            const lineCounts = typedFiles.map(f => f.line_count);
            const partials = typedFiles.map(f => f.partial);
            const syncIds = typedFiles.map(() => syncId);
            const projectIds = typedFiles.map(() => projectId);
            await sql`INSERT INTO project_files (project_id, path, language, line_count, partial, sync_id) SELECT * FROM unnest(${projectIds}::uuid[], ${paths}::text[], ${languages}::text[], ${lineCounts}::int[], ${partials}::boolean[], ${syncIds}::uuid[]) ON CONFLICT (project_id, path) DO UPDATE SET language = EXCLUDED.language, line_count = EXCLUDED.line_count, partial = EXCLUDED.partial, sync_id = EXCLUDED.sync_id`;
          }

          if (chunkList.length > 0) {
            const projectIds = typedChunks.map(() => projectId);
            const keys = typedChunks.map(c => c.key);
            const filePaths = typedChunks.map(c => c.file_path);
            const languages = typedChunks.map(c => c.language);
            const kinds = typedChunks.map(c => c.kind);
            const names = typedChunks.map(c => c.name ?? "");
            const parents = typedChunks.map(c => c.parent ?? "");
            const startLines = typedChunks.map(c => c.start_line);
            const endLines = typedChunks.map(c => c.end_line);
            const hashes = typedChunks.map(c => c.content_hash ?? "");
            const goroutines = typedChunks.map(c => c.uses_goroutines ?? false);
            const syncIds = typedChunks.map(() => syncId);
            await sql`INSERT INTO code_chunks (project_id, chunk_key, file_path, language, kind, name, parent, start_line, end_line, content_hash, uses_goroutines, sync_id) SELECT * FROM unnest(${projectIds}::uuid[], ${keys}::text[], ${filePaths}::text[], ${languages}::text[], ${kinds}::text[], ${names}::text[], ${parents}::text[], ${startLines}::int[], ${endLines}::int[], ${hashes}::text[], ${goroutines}::boolean[], ${syncIds}::uuid[]) ON CONFLICT (project_id, chunk_key) DO UPDATE SET file_path = EXCLUDED.file_path, language = EXCLUDED.language, kind = EXCLUDED.kind, name = EXCLUDED.name, parent = EXCLUDED.parent, start_line = EXCLUDED.start_line, end_line = EXCLUDED.end_line, content_hash = EXCLUDED.content_hash, uses_goroutines = EXCLUDED.uses_goroutines, sync_id = EXCLUDED.sync_id`;
          }

          if (edgeList.length > 0) {
            const projectIds = typedEdges.map(() => projectId);
            const froms = typedEdges.map(e => e.from);
            const tos = typedEdges.map(e => e.to);
            const syncIds = typedEdges.map(() => syncId);
            await sql`INSERT INTO project_edges (project_id, from_path, to_path, sync_id) SELECT * FROM unnest(${projectIds}::uuid[], ${froms}::text[], ${tos}::text[], ${syncIds}::uuid[]) ON CONFLICT (project_id, from_path, to_path) DO UPDATE SET sync_id = EXCLUDED.sync_id`;
          }
        } else {
          const dbPool = await createPool();
          const client = await dbPool.connect();
          try {
            await client.query("BEGIN");
            const existing = await client.query("SELECT id, chunk_count FROM projects WHERE user_id = $1 AND root_hash = $2", [auth.userId, rootHash]);
            const existingRow = existing.rows[0];
            const isNew = !existingRow;

            if (isNew) {
              const countRes = await client.query("SELECT COUNT(*)::int AS count FROM projects WHERE user_id = $1", [auth.userId]);
              const currentProjects = Number(countRes.rows[0]?.count ?? 0);
              const limits = getPlanLimits(auth.planTier);
              if (currentProjects + 1 > limits.projects) {
                await client.query("ROLLBACK");
                return NextResponse.json({ error: `Your plan allows ${limits.projects} projects. Upgrade to sync more.` }, { status: 403 });
              }
            }

            const chunkRes = await client.query("SELECT COALESCE(SUM(chunk_count), 0)::int AS total FROM projects WHERE user_id = $1", [auth.userId]);
            const currentChunks = Number(chunkRes.rows[0]?.total ?? 0);
            const previousChunks = existingRow ? Number(existingRow.chunk_count ?? 0) : 0;
            const limits = getPlanLimits(auth.planTier);
            if (currentChunks - previousChunks + totalChunks > limits.chunks) {
              await client.query("ROLLBACK");
              return NextResponse.json({ error: `Your plan allows ${limits.chunks} chunks. Upgrade to sync more.` }, { status: 403 });
            }

            const upsert = await client.query(
              `INSERT INTO projects (user_id, name, root_hash, file_count, chunk_count, edge_count, languages, external_deps, last_synced_at) VALUES ($1, $2, $3, 0, 0, 0, '{}'::jsonb, '[]'::jsonb, now()) ON CONFLICT (user_id, root_hash) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
              [auth.userId, projectName.trim(), rootHash]
            );
            const projectId = upsert.rows[0].id as string;

            if (fileList.length > 0) {
              await client.query(
                `INSERT INTO project_files (project_id, path, language, line_count, partial, sync_id) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::int[], $5::boolean[], $6::uuid[]) ON CONFLICT (project_id, path) DO UPDATE SET language = EXCLUDED.language, line_count = EXCLUDED.line_count, partial = EXCLUDED.partial, sync_id = EXCLUDED.sync_id`,
                [typedFiles.map(() => projectId), typedFiles.map(f => f.path), typedFiles.map(f => f.language), typedFiles.map(f => f.line_count), typedFiles.map(f => f.partial), typedFiles.map(() => syncId)]
              );
            }

            if (chunkList.length > 0) {
              await client.query(
                `INSERT INTO code_chunks (project_id, chunk_key, file_path, language, kind, name, parent, start_line, end_line, content_hash, uses_goroutines, sync_id) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::int[], $9::int[], $10::text[], $11::boolean[], $12::uuid[]) ON CONFLICT (project_id, chunk_key) DO UPDATE SET file_path = EXCLUDED.file_path, language = EXCLUDED.language, kind = EXCLUDED.kind, name = EXCLUDED.name, parent = EXCLUDED.parent, start_line = EXCLUDED.start_line, end_line = EXCLUDED.end_line, content_hash = EXCLUDED.content_hash, uses_goroutines = EXCLUDED.uses_goroutines, sync_id = EXCLUDED.sync_id`,
                [typedChunks.map(() => projectId), typedChunks.map(c => c.key), typedChunks.map(c => c.file_path), typedChunks.map(c => c.language), typedChunks.map(c => c.kind), typedChunks.map(c => c.name ?? ""), typedChunks.map(c => c.parent ?? ""), typedChunks.map(c => c.start_line), typedChunks.map(c => c.end_line), typedChunks.map(c => c.content_hash ?? ""), typedChunks.map(c => c.uses_goroutines ?? false), typedChunks.map(() => syncId)]
              );
            }

            if (edgeList.length > 0) {
              await client.query(
                `INSERT INTO project_edges (project_id, from_path, to_path, sync_id) SELECT * FROM unnest($1::uuid[], $2::text[], $3::text[], $4::uuid[]) ON CONFLICT (project_id, from_path, to_path) DO UPDATE SET sync_id = EXCLUDED.sync_id`,
                [typedEdges.map(() => projectId), typedEdges.map(e => e.from), typedEdges.map(e => e.to), typedEdges.map(() => syncId)]
              );
            }

            await client.query("COMMIT");
          } finally {
            client.release();
            if (typeof dbPool.end === "function") await dbPool.end();
          }
        }
      } catch (error) {
        logError("sync", error, "upsert project");
        const code = (error as { code?: string })?.code;
        if (code === "42P01" || code === "42703") {
          return NextResponse.json(
            { error: "The database needs the latest migrations (migrations/005_sync_batches.sql)." },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (phase === "commit") {
      const externalDeps = (body as { external_dependencies?: unknown }).external_dependencies;
      const cliVersion = (body as { cli_version?: unknown }).cli_version;

      try {
        if (useHttp) {
          const sql = neon(process.env.DATABASE_URL!);
          const existing = await sql`SELECT id FROM projects WHERE user_id = ${auth.userId} AND root_hash = ${rootHash}`;
          const projectId = existing[0]?.id as string;
          if (!projectId) {
            return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
          }

          const countRows = await sql`SELECT (SELECT COUNT(*)::int FROM project_files WHERE project_id = ${projectId} AND sync_id = ${syncId}) AS files, (SELECT COUNT(*)::int FROM code_chunks WHERE project_id = ${projectId} AND sync_id = ${syncId}) AS chunks, (SELECT COUNT(*)::int FROM project_edges WHERE project_id = ${projectId} AND sync_id = ${syncId}) AS edges`;
          const counts = countRows[0];
          if (Number(counts.files) !== totalFiles || Number(counts.chunks) !== totalChunks || Number(counts.edges) !== totalEdges) {
            return NextResponse.json({ error: "Upload incomplete, please run the sync again." }, { status: 409 });
          }

          await sql.transaction([
            sql`DELETE FROM project_files WHERE project_id = ${projectId} AND (sync_id IS NULL OR sync_id <> ${syncId})`,
            sql`DELETE FROM code_chunks WHERE project_id = ${projectId} AND (sync_id IS NULL OR sync_id <> ${syncId})`,
            sql`DELETE FROM project_edges WHERE project_id = ${projectId} AND (sync_id IS NULL OR sync_id <> ${syncId})`,
            sql`UPDATE projects SET file_count = ${totalFiles}, chunk_count = ${totalChunks}, edge_count = ${totalEdges}, languages = COALESCE((SELECT jsonb_object_agg(language, c) FROM (SELECT language, COUNT(*)::int AS c FROM project_files WHERE project_id = ${projectId} GROUP BY language) t), '{}'::jsonb), external_deps = ${JSON.stringify(Array.isArray(externalDeps) ? externalDeps : [])}::jsonb, last_synced_at = now() WHERE id = ${projectId}`,
          ]);
        } else {
          const dbPool = await createPool();
          const client = await dbPool.connect();
          try {
            await client.query("BEGIN");
            const existing = await client.query("SELECT id FROM projects WHERE user_id = $1 AND root_hash = $2", [auth.userId, rootHash]);
            const projectId = existing.rows[0]?.id as string;
            if (!projectId) {
              await client.query("ROLLBACK");
              return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
            }

            const countRes = await client.query(
              "SELECT (SELECT COUNT(*)::int FROM project_files WHERE project_id = $1 AND sync_id = $2) AS files, (SELECT COUNT(*)::int FROM code_chunks WHERE project_id = $1 AND sync_id = $2) AS chunks, (SELECT COUNT(*)::int FROM project_edges WHERE project_id = $1 AND sync_id = $2) AS edges",
              [projectId, syncId]
            );
            const counts = countRes.rows[0];
            if (Number(counts.files) !== totalFiles || Number(counts.chunks) !== totalChunks || Number(counts.edges) !== totalEdges) {
              await client.query("ROLLBACK");
              return NextResponse.json({ error: "Upload incomplete, please run the sync again." }, { status: 409 });
            }

            await client.query("DELETE FROM project_files WHERE project_id = $1 AND (sync_id IS NULL OR sync_id <> $2)", [projectId, syncId]);
            await client.query("DELETE FROM code_chunks WHERE project_id = $1 AND (sync_id IS NULL OR sync_id <> $2)", [projectId, syncId]);
            await client.query("DELETE FROM project_edges WHERE project_id = $1 AND (sync_id IS NULL OR sync_id <> $2)", [projectId, syncId]);
            await client.query(
              "UPDATE projects SET file_count = $1, chunk_count = $2, edge_count = $3, languages = COALESCE((SELECT jsonb_object_agg(language, c) FROM (SELECT language, COUNT(*)::int AS c FROM project_files WHERE project_id = $6 GROUP BY language) t), '{}'::jsonb), external_deps = $5::jsonb, last_synced_at = now() WHERE id = $6",
              [totalFiles, totalChunks, totalEdges, JSON.stringify({}), JSON.stringify(Array.isArray(externalDeps) ? externalDeps : []), projectId]
            );
            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK").catch(() => undefined);
            throw error;
          } finally {
            client.release();
            if (typeof dbPool.end === "function") await dbPool.end();
          }
        }
      } catch (error) {
        logError("sync", error, "commit");
        const code = (error as { code?: string })?.code;
        if (code === "42P01" || code === "42703") {
          return NextResponse.json(
            { error: "The database needs the latest migrations (migrations/005_sync_batches.sql)." },
            { status: 503 }
          );
        }
        return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
      }

      const existing = useHttp
        ? await neon(process.env.DATABASE_URL!)`SELECT id FROM projects WHERE user_id = ${auth.userId} AND root_hash = ${rootHash}`
        : await (async () => {
            const c = await createPool();
            const cl = await c.connect();
            try {
              return await cl.query("SELECT id FROM projects WHERE user_id = $1 AND root_hash = $2", [auth.userId, rootHash]);
            } finally {
              cl.release();
              if (typeof c.end === "function") await c.end();
            }
          })();

      const projectId = (Array.isArray(existing) ? existing[0]?.id : existing.rows?.[0]?.id) as string;

      return NextResponse.json({
        project_id: projectId,
        files: totalFiles,
        chunks: totalChunks,
        edges: totalEdges,
        url: `/dashboard/projects/${projectId}`,
      });
    }

    return NextResponse.json({ error: "phase must be batch or commit." }, { status: 400 });
  }

  const parsed = parseSyncPayload(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await syncProject(auth.userId, auth.planTier, parsed.payload);

  if (!result.ok) {
    if (result.status === 403) {
      return NextResponse.json(
        { error: result.error, limit: result.limit, used: result.used, plan: result.plan },
        { status: 403 }
      );
    }
    if (result.status === 503) {
      return NextResponse.json(
        { error: "The database needs the latest migrations (migrations/005_sync_batches.sql)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    project_id: result.projectId,
    files: result.files,
    chunks: result.chunks,
    edges: result.edges,
    url: `/dashboard/projects/${result.projectId}`,
  });
}
