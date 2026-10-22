import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"
import { getPlanLimits } from "@/lib/plans"
import { isProjectId, loadProjectPage, type ProjectFileRow, type ProjectEdgeRow } from "@/lib/projects"
import { buildGraphModel, type NodeMeta } from "@/lib/graph"
import { computeDeterministicGuide } from "@/lib/guide"
import { askAI, checkPlanLimit, checkBurstLimit, recordAIEvent, checkCache, storeQuery, type AskContext, AI_MODEL, AI_ENABLED, hashContext } from "@/lib/ai"

const sql = neon(process.env.DATABASE_URL!)

function extractTokens(text: string): string[] {
  const words = text.toLowerCase().match(/[a-zA-Z_][a-zA-Z0-9_\/\.\-]*/g) ?? []
  return [...new Set(words.filter((w) => w.length > 2))]
}

function findRelevantFiles(question: string, files: ProjectFileRow[], model: ReturnType<typeof buildGraphModel>, limit = 40): ProjectFileRow[] {
  const tokens = extractTokens(question)
  const scored = files.map((f) => {
    let score = 0
    const pathLower = f.path.toLowerCase()
    for (const token of tokens) {
      if (pathLower.includes(token)) score += 3
    }
    const conns = model.nodes.get(f.path)?.connections ?? 0
    score += Math.min(conns, 5)
    return { file: f, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit).map((s) => s.file)
}

function buildContextForAI(
  question: string,
  selectedFiles: ProjectFileRow[],
  model: ReturnType<typeof buildGraphModel>,
  manifest: Record<string, unknown>,
  readme: string | undefined
) {
  const allPaths = new Set<string>()
  for (const f of selectedFiles) {
    allPaths.add(f.path)
    const neighbors = model.adjacency.get(f.path) ?? new Set()
    for (const n of neighbors) allPaths.add(n)
  }
  const hotspots = model.hotspots.slice(0, 10).map((h) => h.id)
  for (const h of hotspots) allPaths.add(h)

  const finalFiles = Array.from(allPaths)
    .map((p) => model.nodes.get(p))
    .filter((n): n is NodeMeta => n !== undefined)
    .map((n) => ({ path: n.id, symbols: [] as string[] }))
    .slice(0, 60)

  const moduleSummary = computeDeterministicGuide(model, manifest, readme ? { size: readme.length, preview: readme.slice(0, 200), truncated: readme.length > 200 } : undefined).modules
    .map((m) => `${m.name} (${m.fileCount} files)`)
    .join(", ")

  return {
    files: finalFiles,
    hotspots,
    moduleSummary,
  }
}

export async function POST(req: Request) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)

  let body: { projectId?: string; question?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { projectId, question } = body
  if (!projectId || !isProjectId(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }
  if (!question || question.trim().length === 0 || question.length > 500) {
    return NextResponse.json({ error: "Question required (max 500 chars)" }, { status: 400 })
  }

  const projectRow = await sql`SELECT * FROM projects WHERE id = ${projectId} AND user_id = ${session.user.id}`
  if (!projectRow[0]) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const limits = getPlanLimits(projectRow[0].plan_tier)
  const planCheck = await checkPlanLimit(sql, session.user.id, limits.questionsPerMonth)
  if (!planCheck.allowed) {
    return NextResponse.json({ error: "Monthly AI limit reached", limit: limits.questionsPerMonth, used: planCheck.used }, { status: 403 })
  }

  const burstCheck = await checkBurstLimit(sql, session.user.id)
  if (!burstCheck.allowed) {
    return NextResponse.json({ error: "Daily burst limit reached (20)", used: burstCheck.used }, { status: 429 })
  }

  const data = await loadProjectPage(session.user.id, projectId)
  if (!data) {
    return NextResponse.json({ error: "Project data not found" }, { status: 404 })
  }

  const files: ProjectFileRow[] = data.files
  const edges: ProjectEdgeRow[] = data.edges

  const model = buildGraphModel(files, edges)
  const manifest = { name: projectRow[0].name, scripts: {} }
  const metaRow = await sql`SELECT * FROM project_meta WHERE project_id = ${projectId}`
  const readme = metaRow[0]?.readme

  const relevantFiles = findRelevantFiles(question, files, model)
  const context = buildContextForAI(question, relevantFiles, model, manifest, readme)

  const includeReadme = false
  const contextForHash: AskContext = { question, projectId, userId: session.user.id, includeReadme }
  const inputHash = hashContext(contextForHash, context)

  const cached = await checkCache(sql, session.user.id, projectId, question, inputHash)
  if (cached) {
    await recordAIEvent(sql, session.user.id, projectId, "question", inputHash, "cache")
    return NextResponse.json({ ...cached, cached: true })
  }

  const aiResult = await askAI(
    { question, projectId, userId: session.user.id, includeReadme },
    { manifest, readme, ...context }
  )

  if (!aiResult.ok) {
    return NextResponse.json({ error: aiResult.error, retry: aiResult.retry }, { status: 500 })
  }

  await recordAIEvent(sql, session.user.id, projectId, "question", inputHash, AI_MODEL)

  const answer = {
    answer: aiResult.answer,
    files: aiResult.files,
    confidence: aiResult.confidence,
    followups: aiResult.followups,
  }

  await storeQuery(sql, session.user.id, projectId, question, answer, context.files)

  return NextResponse.json({ ...answer, cached: false })
}