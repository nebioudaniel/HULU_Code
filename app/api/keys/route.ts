import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createApiKey, listApiKeys } from "@/lib/api-keys";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await listApiKeys(session.user.id);
  return NextResponse.json({ keys });
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await createApiKey(
    session.user.id,
    body.name ?? "",
    session.user.plan_tier
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(
    { key: result.key, record: result.record },
    { status: 201 }
  );
}
