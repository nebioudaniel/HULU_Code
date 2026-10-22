import { fileRole, type GraphModel, type NodeMeta } from "./graph.ts"
import { DEEPSEEK_API_KEY, AI_BASE_URL, AI_MODEL, AI_ENABLED } from "./ai.ts"

export { DEEPSEEK_API_KEY, AI_BASE_URL, AI_MODEL, AI_ENABLED }

export type Manifest = {
  name?: string
  description?: string
  scripts?: Record<string, string>
  main?: string
  goModule?: string
  goVersion?: string
  pyProject?: { name?: string; description?: string }
}

export type ReadmeInfo = {
  size: number
  preview: string
  truncated: boolean
}

export type ProjectMeta = {
  manifest: Manifest
  readme?: ReadmeInfo
}

export type RankedFile = {
  path: string
  score: number
  reasons: string[]
  role: string
  module: string
  dependents: number
}

export type ModuleInfo = {
  name: string
  fileCount: number
  topFiles: string[]
}

export type DeterministicGuide = {
  whatFor: string
  modules: ModuleInfo[]
  readingList: { path: string; reason: string }[]
  flow: string
  careful: { path: string; advice: string }[]
}

export function entryPointType(path: string): { type: string; reason: string } | null {
  const base = path.split("/").pop() ?? path
  const lower = base.toLowerCase()

  if (path.startsWith("app/") && (lower === "page.tsx" || lower === "page.ts" || lower === "page.jsx" || lower === "page.js")) {
    return { type: "nextjs-page", reason: "Next.js App Router page entry point" }
  }
  if (path.startsWith("app/") && (lower === "layout.tsx" || lower === "layout.ts" || lower === "layout.jsx" || lower === "layout.js")) {
    return { type: "nextjs-layout", reason: "Next.js App Router layout entry point" }
  }
  if (path.startsWith("pages/") && (lower === "index.tsx" || lower === "index.ts" || lower === "index.jsx" || lower === "index.js")) {
    return { type: "nextjs-pages-index", reason: "Next.js Pages Router index entry point" }
  }
  if (lower === "middleware.ts" || lower === "middleware.js" || lower === "proxy.ts" || lower === "proxy.js") {
    return { type: "nextjs-middleware", reason: "Next.js middleware or proxy entry point" }
  }
  if ((lower === "index.ts" || lower === "index.js" || lower === "index.tsx" || lower === "index.jsx") && (path.startsWith("src/") || path === lower || path.startsWith("lib/"))) {
    return { type: "node-main", reason: "Node.js main entry point (index file at root or src/)" }
  }
  if (lower === "server.ts" || lower === "server.js" || lower === "server.tsx" || lower === "server.jsx") {
    return { type: "node-server", reason: "Node.js server entry point" }
  }
  if (lower === "main.go" || (path.startsWith("cmd/") && lower === "main.go")) {
    return { type: "go-main", reason: "Go main package entry point" }
  }
  if (lower === "main.py" || lower === "app.py" || lower === "__main__.py" || lower === "manage.py" || lower === "wsgi.py") {
    return { type: "python-main", reason: "Python main entry point" }
  }
  return null
}

export function moduleLabel(path: string): string {
  const parts = path.split("/")
  if (parts.length < 2) return parts[0] || path

  if (parts[0] === "src" && parts.length >= 3) {
    if (parts[1] === "packages" || parts[1] === "apps") {
      return `${parts[1]}/${parts[2]}`
    }
    return parts[1]
  }
  if (parts[0] === "app") {
    return `app/${parts[1]}`
  }
  if (parts[0] === "packages" || parts[0] === "apps") {
    return parts.slice(0, 2).join("/")
  }
  return parts[0]
}

export function semanticModuleLabel(path: string): string {
  const parts = path.split("/")
  const base = parts[parts.length - 1]?.toLowerCase() ?? ""
  const all = path.toLowerCase()

  if (all.includes("auth") || all.includes("login") || all.includes("session") || base === "auth.ts") return "auth"
  if (all.includes("payment") || all.includes("billing") || all.includes("chapa") || base === "payments.ts") return "payments"
  if (all.includes("database") || all.includes("db") || all.includes("prisma") || all.includes("sql") || base === "db.ts") return "database"
  if (all.includes("ui") || all.includes("component") || parts[0] === "components" || base === "ui.tsx") return "ui"
  if (all.includes("api") || parts[0] === "api" || base === "api.ts") return "api"
  if (all.includes("cli") || parts[0] === "cli" || base === "cli.ts") return "cli"
  if (all.includes("doc") || parts[0] === "docs") return "docs"
  if (all.includes("test") || all.includes("spec") || parts[0] === "tests") return "tests"
  if (parts[0] === "lib" || parts[0] === "utils" || parts[0] === "helpers") return "lib"
  return moduleLabel(path)
}

export function computeDeterministicGuide(
  model: GraphModel,
  manifest: Manifest,
  readme?: ReadmeInfo
): DeterministicGuide {
  const nodes = Array.from(model.nodes.values())
  const entryPoints = nodes
    .map((n) => ({ node: n, entry: entryPointType(n.id) }))
    .filter((e) => e.entry)
    .map((e) => ({ path: e.node.id, reason: e.entry!.reason, type: e.entry!.type }))

  const entryPointBonus = new Set(entryPoints.map((e) => e.path))
  void readme

  const moduleMap = new Map<string, { files: NodeMeta[]; count: number }>()
  for (const node of nodes) {
    const mod = semanticModuleLabel(node.id)
    const existing = moduleMap.get(mod) ?? { files: [], count: 0 }
    existing.files.push(node)
    existing.count++
    moduleMap.set(mod, existing)
  }

  const modules: ModuleInfo[] = []
  for (const [name, { files }] of moduleMap) {
    const topFiles = files
      .sort((a, b) => (b.connections ?? 0) - (a.connections ?? 0))
      .slice(0, 2)
      .map((f) => f.id)
    modules.push({ name, fileCount: files.length, topFiles })
  }
  modules.sort((a, b) => b.fileCount - a.fileCount)

  const ranked: RankedFile[] = []
  for (const node of nodes) {
    const role = fileRole(node.id)
    if (role === "test" || role === "type-definitions" || role === "config" || role === "ui-primitive") continue
    if (node.id.endsWith(".lock") || node.id.endsWith(".sum")) continue

    const inDegree = model.inDegree.get(node.id) ?? 0
    const outDegree = model.outDegree.get(node.id) ?? 0
    const dependents = inDegree

    let score = 3 * dependents + Math.min(outDegree, 5)
    if (entryPointBonus.has(node.id)) score += 10
    score += Math.min(node.connections ?? 0, 3)

    const reasons: string[] = []
    if (dependents > 0) reasons.push(`Imported by ${dependents} file${dependents > 1 ? "s" : ""}`)
    if (entryPointBonus.has(node.id)) reasons.push("Entry point")
    if ((node.connections ?? 0) > 0) reasons.push(`${node.connections} connections`)

    ranked.push({
      path: node.id,
      score,
      reasons,
      role,
      module: semanticModuleLabel(node.id),
      dependents,
    })
  }

  ranked.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))

  const readingList: { path: string; reason: string }[] = []
  const seenModules = new Set<string>()
  const entryPointsInRanked = ranked.filter((r) => entryPointBonus.has(r.path))
  for (const r of entryPointsInRanked) {
    readingList.push({ path: r.path, reason: r.reasons.join("; ") })
    seenModules.add(r.module)
    if (readingList.length >= 8) break
  }
  for (const r of ranked) {
    if (readingList.length >= 8) break
    if (seenModules.has(r.module) && seenModules.size >= 3) continue
    readingList.push({ path: r.path, reason: r.reasons.join("; ") })
    seenModules.add(r.module)
  }

  const flowParts: string[] = []
  const moduleEdges = new Map<string, Map<string, number>>()
  for (const edge of Array.from(model.adjacency.entries())) {
    const [from, targets] = edge
    const fromMod = semanticModuleLabel(from)
    for (const to of targets) {
      const toMod = semanticModuleLabel(to)
      if (fromMod !== toMod) {
        const fromMap = moduleEdges.get(fromMod) ?? new Map()
        fromMap.set(toMod, (fromMap.get(toMod) ?? 0) + 1)
        moduleEdges.set(fromMod, fromMap)
      }
    }
  }
  const sortedEdges: { from: string; to: string; count: number }[] = []
  for (const [from, targets] of moduleEdges) {
    for (const [to, count] of targets) {
      sortedEdges.push({ from, to, count })
    }
  }
  sortedEdges.sort((a, b) => b.count - a.count)
  for (const e of sortedEdges.slice(0, 4)) {
    flowParts.push(`${e.from} \u2192 ${e.to} (${e.count})`)
  }
  const flow = flowParts.length > 0 ? flowParts.join("; ") : "No cross-module imports detected."

  const careful = model.hotspots.slice(0, 5).map((h) => ({
    path: h.id,
    advice: `Hotspot (${h.connections} connections). ` + (h.role ? `Role: ${h.role}. ` : "") + "Changes here propagate widely.",
  }))

  const whatForParts: string[] = []
  if (manifest.description) whatForParts.push(manifest.description)
  if (manifest.name) whatForParts.push(`Project: ${manifest.name}`)
  if (entryPoints.length > 0) {
    const types = [...new Set(entryPoints.map((e) => e.type))]
    whatForParts.push(`Entry points: ${types.join(", ")}`)
  }
  const whatFor = whatForParts.join(". ") || "A software project with no detected entry points or description."

  return { whatFor, modules, readingList, flow, careful }
}

export function inputHash(model: GraphModel, includeReadme: boolean): string {
  const totalFiles = model.totalFiles
  const totalEdges = model.totalEdges
  const lastSynced = Date.now()
  return `${totalFiles}:${totalEdges}:${includeReadme}:${lastSynced}`
}

type ModuleItem = { name: string; purpose: string }
type ReadingItem = { path: string; reason: string }
type CarefulItem = { path: string; advice: string }
type AIOutput = {
  what_for: string
  modules: ModuleItem[]
  reading_list: ReadingItem[]
  flow: string
  careful: CarefulItem[]
}

function aiOutputToGuide(ai: AIOutput): DeterministicGuide {
  return {
    whatFor: ai.what_for,
    modules: ai.modules.map((m) => ({ name: m.name, purpose: m.purpose, fileCount: 0, topFiles: [] })),
    readingList: ai.reading_list.map((r) => ({ path: r.path, reason: r.reason })),
    flow: ai.flow,
    careful: ai.careful.map((c) => ({ path: c.path, advice: c.advice })),
  }
}

export function validateAIOutput(obj: unknown, candidates: string[]): { ok: boolean; data?: DeterministicGuide; error?: string } {
  if (!obj || typeof obj !== "object") return { ok: false, error: "Not an object" }
  const o = obj as Record<string, unknown>

  if (typeof o.what_for !== "string") return { ok: false, error: "what_for must be string" }
  if (!Array.isArray(o.modules)) return { ok: false, error: "modules must be array" }
  for (const m of o.modules) {
    if (typeof m !== "object" || m === null) return { ok: false, error: "modules items must be objects" }
    const mm = m as ModuleItem
    if (typeof mm.name !== "string" || typeof mm.purpose !== "string") {
      return { ok: false, error: "modules items must have name and purpose strings" }
    }
  }
  if (!Array.isArray(o.reading_list)) return { ok: false, error: "reading_list must be array" }
  if (o.reading_list.length < 5 || o.reading_list.length > 8) return { ok: false, error: "reading_list length must be 5-8" }
  for (const r of o.reading_list) {
    if (typeof r !== "object" || r === null) return { ok: false, error: "reading_list items must be objects" }
    const rr = r as ReadingItem
    if (typeof rr.path !== "string" || typeof rr.reason !== "string") {
      return { ok: false, error: "reading_list items must have path and reason strings" }
    }
    if (!candidates.includes(rr.path)) return { ok: false, error: `reading_list path not in candidates: ${rr.path}` }
    if ((rr.reason?.length ?? 0) > 140) return { ok: false, error: "reason exceeds 140 chars" }
  }
  if (typeof o.flow !== "string") return { ok: false, error: "flow must be string" }
  if (!Array.isArray(o.careful)) return { ok: false, error: "careful must be array" }
  for (const c of o.careful) {
    if (typeof c !== "object" || c === null) return { ok: false, error: "careful items must be objects" }
    const cc = c as CarefulItem
    if (typeof cc.path !== "string" || typeof cc.advice !== "string") {
      return { ok: false, error: "careful items must have path and advice strings" }
    }
    if (!candidates.includes(cc.path)) return { ok: false, error: `careful path not in candidates: ${cc.path}` }
  }

  return { ok: true, data: aiOutputToGuide(o as AIOutput) }
}