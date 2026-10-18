import { gunzipSync } from "node:zlib";

import { NextResponse } from "next/server";

import { verifyApiKey } from "@/lib/api-keys";
import { parseSyncPayload, syncProject } from "@/lib/projects";

const BEARER_PREFIX = "Bearer ";
const MAX_BYTES = 8 * 1024 * 1024;

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

  let buffer: Buffer;
  try {
    buffer = Buffer.from(await req.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "Could not read the request body." }, { status: 400 });
  }

  if (buffer.length > MAX_BYTES) {
    return tooLarge();
  }

  let text: string;
  const encoding = req.headers.get("content-encoding") ?? "";

  if (encoding.toLowerCase().includes("gzip")) {
    try {
      text = gunzipSync(buffer, { maxOutputLength: MAX_BYTES }).toString("utf8");
    } catch (error) {
      const code = error instanceof Error ? (error as { code?: string }).code : undefined;
      if (code === "ERR_BUFFER_TOO_LARGE") {
        return tooLarge();
      }
      return NextResponse.json({ error: "Body must be valid gzip data." }, { status: 400 });
    }
  } else {
    text = buffer.toString("utf8");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
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

function tooLarge() {
  return NextResponse.json(
    { error: "This project is too large to sync. Try scanning a subfolder." },
    { status: 413 }
  );
}
