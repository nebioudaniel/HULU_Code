import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { connection } from "next/server";
import { isProjectId, listProjectChunks } from "@/lib/projects";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection();

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!isProjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const path = new URL(req.url).searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const chunks = await listProjectChunks(id, [path]);

  return NextResponse.json({ chunks });
}
