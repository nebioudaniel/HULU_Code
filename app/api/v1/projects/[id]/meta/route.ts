import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"
import { isProjectId } from "@/lib/projects"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!isProjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const projectRow = await sql`SELECT * FROM projects WHERE id = ${id} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const metaRow = await sql`SELECT * FROM project_meta WHERE project_id = ${id}`

  return NextResponse.json({
    manifest: metaRow[0]?.manifest ?? {},
    readme: metaRow[0]?.readme ?? null,
    readmeUpdatedAt: metaRow[0]?.readme_updated_at ?? null,
  })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!isProjectId(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const projectRow = await sql`SELECT * FROM projects WHERE id = ${id} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await sql`UPDATE project_meta SET readme = NULL, readme_updated_at = NULL WHERE project_id = ${id}`

  return NextResponse.json({ ok: true })
}