import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"

export async function GET() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const rows = await sql`SELECT id, name FROM projects WHERE user_id = ${session.user.id} ORDER BY last_synced_at DESC NULLS LAST, created_at DESC`

  return NextResponse.json({
    projects: rows.map((r) => ({
      id: r.id,
      name: r.name,
    })),
  })
}
