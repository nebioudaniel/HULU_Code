import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"
import { isProjectId } from "@/lib/projects"

export async function GET(req: Request): Promise<NextResponse> {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const projectId = new URL(req.url).searchParams.get("projectId")
  if (!projectId || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const projectRow = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const rows = await sql`SELECT id, question, answer, files, created_at FROM queries WHERE project_id = ${projectId} AND user_id = ${session.user.id} ORDER BY created_at DESC LIMIT 100`

  return NextResponse.json({
    queries: rows.map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      files: r.files,
      createdAt: r.created_at,
    })),
  })
}

export async function DELETE(req: Request): Promise<NextResponse> {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const searchParams = new URL(req.url).searchParams
  const projectId = searchParams.get("projectId")
  if (!projectId || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const projectRow = await sql`SELECT id FROM projects WHERE id = ${projectId} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const id = searchParams.get("id")

  if (id) {
    await sql`DELETE FROM queries WHERE id = ${id} AND user_id = ${session.user.id} AND project_id = ${projectId}`
    return NextResponse.json({ ok: true })
  }

  await sql`DELETE FROM queries WHERE project_id = ${projectId} AND user_id = ${session.user.id}`
  return NextResponse.json({ ok: true })
}