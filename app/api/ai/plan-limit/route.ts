import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"
import { getPlanLimits } from "@/lib/plans"
import { isProjectId } from "@/lib/projects"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId?: string }> }
) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await params
  if (!projectId || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  const projectRow = await sql`SELECT * FROM projects WHERE id = ${projectId} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const userRow = await sql`SELECT plan_tier FROM users WHERE id = ${session.user.id}`
  const userPlanTier = userRow[0]?.plan_tier ?? "free"

  const limits = getPlanLimits(userPlanTier)

  const monthly = await sql`SELECT COUNT(*)::int AS count FROM ai_events WHERE user_id = ${session.user.id} AND kind = 'question' AND created_at > NOW() - INTERVAL '1 month'`
  const used = (monthly as { count: number }[])[0]?.count ?? 0

  const allowed = used < limits.questionsPerMonth

  return NextResponse.json({
    allowed,
    used,
    limit: limits.questionsPerMonth,
    planTier: userPlanTier,
  })
}