import { NextResponse } from "next/server"
import { connection } from "next/server"
import { neon } from "@neondatabase/serverless"

import { auth } from "@/auth"
import { isProjectId, loadProjectPage, type ProjectFileRow, type ProjectEdgeRow } from "@/lib/projects"
import { buildGraphModel } from "@/lib/graph"
import { computeDeterministicGuide, inputHash } from "@/lib/guide"

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

  const guideRow = await sql`SELECT * FROM project_guides WHERE project_id = ${id}`
  const metaRow = await sql`SELECT * FROM project_meta WHERE project_id = ${id}`

  const includeReadme = guideRow[0]?.include_readme ?? false

  const data = await loadProjectPage(session.user.id, id)
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const files: ProjectFileRow[] = data.files
  const edges: ProjectEdgeRow[] = data.edges
  const manifest = {
    name: projectRow[0].name,
    description: projectRow[0].external_deps,
    scripts: {},
  }
  const readme = metaRow[0]?.readme ? { size: metaRow[0].readme.length, preview: metaRow[0].readme.slice(0, 200), truncated: metaRow[0].readme.length > 200 } : undefined

  const model = buildGraphModel(files, edges)
  const deterministicGuide = computeDeterministicGuide(model, manifest, readme)

  const currentHash = inputHash(model, includeReadme)
  const isOutOfDate = guideRow[0] && guideRow[0].input_hash !== currentHash

  return NextResponse.json({
    guide: guideRow[0]?.guide ?? deterministicGuide,
    source: guideRow[0]?.source ?? "deterministic",
    model: guideRow[0]?.model,
    generatedAt: guideRow[0]?.generated_at,
    includeReadme,
    isOutOfDate,
    readingListCandidates: deterministicGuide.readingList.map((r) => r.path),
  })
}