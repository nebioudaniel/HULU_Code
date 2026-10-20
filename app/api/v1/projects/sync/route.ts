import { NextResponse } from "next/server";

import { verifyApiKey } from "@/lib/api-keys";
import { parseSyncPayload, syncProject } from "@/lib/projects";
import { logError } from "@/lib/errors";

const BEARER_PREFIX = "Bearer ";

export async function POST(req: Request) {
  const header = req.headers.get("authorization");

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const rawKey = header.slice(BEARER_PREFIX.length).trim();
  const auth = await verifyApiKey(rawKey);

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const SYNC_MAX_BYTES = Number(process.env.SYNC_MAX_BYTES ?? 1500000);

  let buffer: Uint8Array;
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

    buffer = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } catch (error) {
    logError("sync", error, "read body");
    const code = (error as { code?: string })?.code;
    if (code === "ERR_BUFFER_TOO_LARGE") {
      return NextResponse.json(
        { error: "Project is too large to sync. Try running the sync from a subfolder." },
        { status: 413 }
      );
    }
    return NextResponse.json({ error: "Body must be valid gzip data." }, { status: 400 });
  }

  let text: string;
  try {
    text = new TextDecoder().decode(buffer);
  } catch (error) {
    logError("sync", error, "decompress");
    return NextResponse.json({ error: "Body must be valid gzip data." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch (error) {
    logError("sync", error, "parse json");
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseSyncPayload(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let result;
  try {
    result = await syncProject(auth.userId, auth.planTier, parsed.payload);
  } catch (error) {
    logError("sync", error, "upsert project");
    return NextResponse.json({ error: "Could not save the project. Please try again." }, { status: 500 });
  }

  if (!result.ok) {
    if (result.status === 403) {
      return NextResponse.json(
        { error: result.error, limit: result.limit, used: result.used, plan: result.plan },
        { status: 403 }
      );
    }
    if (result.status === 503) {
      return NextResponse.json(
        { error: "The database is not set up for projects yet. Run migrations/003_projects.sql." },
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
