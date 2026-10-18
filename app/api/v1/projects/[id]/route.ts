import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { verifyApiKey } from "@/lib/api-keys";
import { deleteProject, isProjectId } from "@/lib/projects";

const BEARER_PREFIX = "Bearer ";

async function resolveUserId(req: Request): Promise<string | null> {
  const session = await auth();

  if (session?.user?.id) {
    return session.user.id;
  }

  const header = req.headers.get("authorization");

  if (!header || !header.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const result = await verifyApiKey(header.slice(BEARER_PREFIX.length).trim());
  return result.ok ? result.userId : null;
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await resolveUserId(req);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!isProjectId(id)) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const removed = await deleteProject(userId, id);

  if (!removed) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
