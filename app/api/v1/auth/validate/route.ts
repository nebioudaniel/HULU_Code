import { NextResponse } from "next/server";

import { verifyApiKey } from "@/lib/api-keys";

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

  const result = await verifyApiKey(rawKey);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    valid: true,
    user_id: result.userId,
    plan_tier: result.planTier,
  });
}
