import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { connection } from "next/server";
import { isProjectId, listProjectEdges } from "@/lib/projects";

export async function GET(
  _req: Request,
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

  const edges = await listProjectEdges(id, 1500);

  return NextResponse.json({ edges });
}
