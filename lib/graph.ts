export type FileRow = {
  path: string
  language: string
  lineCount: number
  partial: boolean
  chunkCount: number
}

export type Edge = { fromPath: string; toPath: string }

export type FileRole =
  | "api-route"
  | "page"
  | "layout"
  | "server-action"
  | "component"
  | "ui-primitive"
  | "hook"
  | "type-definitions"
  | "config"
  | "test"
  | "cli"
  | "backend"
  | "other"

export type RoleInfo = {
  role: FileRole
  label: string
  icon: string
  color: string // CSS variable name, e.g. --graph-1
}

export type NodeMeta = {
  id: string
  label: string
  folder: string
  language: string
  role: FileRole
  connections: number
  inDegree: number
  outDegree: number
}

export type FolderAgg = {
  folder: string
  fileCount: number
  roleMix: Record<FileRole, number>
  outgoingImports: number // edges to other folders
  incomingImports: number // edges from other folders
  hotspot: NodeMeta | null
}

export type GraphModel = {
  nodes: Map<string, NodeMeta>
  adjacency: Map<string, Set<string>> // out-edges (imports)
  reverseAdjacency: Map<string, Set<string>> // importers
  inDegree: Map<string, number>
  outDegree: Map<string, number>
  folders: Map<string, FolderAgg>
  sccs: string[][] // cycles (SCC size >= 2)
  orphans: string[] // no connections
  hotspots: NodeMeta[] // top 10 by connections
  totalFiles: number
  totalEdges: number
  totalImports: number
}

export const GRAPH_COLORS = [
  "--graph-1",
  "--graph-2",
  "--graph-3",
  "--graph-4",
  "--graph-5",
  "--graph-6",
  "--graph-7",
  "--graph-8",
  "--graph-9",
  "--graph-10",
]

const ROLE_ORDER: FileRole[] = [
  "api-route",
  "page",
  "layout",
  "server-action",
  "component",
  "ui-primitive",
  "hook",
  "type-definitions",
  "config",
  "test",
  "cli",
  "backend",
  "other",
]

const ROLE_LABELS: Record<FileRole, string> = {
  "api-route": "API route",
  page: "Page",
  layout: "Layout",
  "server-action": "Server action",
  component: "Component",
  "ui-primitive": "UI primitive",
  hook: "Hook",
  "type-definitions": "Type definitions",
  config: "Config",
  test: "Test",
  cli: "CLI",
  backend: "Backend",
  other: "Other",
}

const ROLE_ICONS: Record<FileRole, string> = {
  "api-route": "Route",
  page: "FileText",
  layout: "Layout",
  "server-action": "Zap",
  component: "Code",
  "ui-primitive": "Layers",
  hook: "Hook",
  "type-definitions": "FileType",
  config: "Settings",
  test: "TestTube",
  cli: "Terminal",
  backend: "Database",
  other: "File",
}

const CONFIG_BASENAMES = new Set([
  "package.json",
  "tsconfig.json",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tailwind.config.js",
  "tailwind.config.ts",
  "postcss.config.js",
  "eslint.config.js",
  ".eslintrc.json",
  "tsconfig.build.json",
])

export function fileRole(path: string): FileRole {
  const base = path.split("/").pop() ?? path
  const lower = base.toLowerCase()
  const ext = lower.slice(lower.lastIndexOf("."))

  if (ext === ".d.ts") return "type-definitions"
  if (lower === "route.ts" || lower === "route.js") return "api-route"
  if (
    lower === "page.ts" ||
    lower === "page.tsx" ||
    lower === "page.js" ||
    lower === "page.jsx"
  )
    return "page"
  if (
    lower === "layout.ts" ||
    lower === "layout.tsx" ||
    lower === "layout.js" ||
    lower === "layout.jsx"
  )
    return "layout"
  if (lower.includes("action") && (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx"))
    return "server-action"
  if (
    (lower.startsWith("use") && (ext === ".ts" || ext === ".tsx" || ext === ".js" || ext === ".jsx"))
  )
    return "hook"
  if (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("_test") ||
    path.includes("/tests/") ||
    path.includes("/_test/")
  )
    return "test"
  if (path.startsWith("components/ui/")) return "ui-primitive"
  if (path.startsWith("components/")) return "component"
  if (path.startsWith("cli/")) return "cli"
  if (path.startsWith("backend/")) return "backend"
  if (CONFIG_BASENAMES.has(lower) || path.startsWith("config/")) return "config"
  if (ext === ".go") return "backend"
  return "other"
}

export function roleInfo(role: FileRole, color: string): RoleInfo {
  return { role, label: ROLE_LABELS[role], icon: ROLE_ICONS[role], color }
}

function roleColorIndex(role: FileRole): number {
  return ROLE_ORDER.indexOf(role) % GRAPH_COLORS.length
}

export function topFolder(path: string): string {
  const segment = path.split("/")[0]
  return segment || path
}

function languageOf(path: string): string {
  const ext = path.slice(path.lastIndexOf("."))
  switch (ext) {
    case ".ts":
    case ".tsx":
      return "TypeScript"
    case ".js":
    case ".jsx":
    case ".mjs":
      return "JavaScript"
    case ".go":
      return "Go"
    case ".py":
      return "Python"
    default:
      return "Other"
  }
}

export function buildGraphModel(files: FileRow[], edges: Edge[]): GraphModel {
  const nodes = new Map<string, NodeMeta>()
  const inDegree = new Map<string, number>()
  const outDegree = new Map<string, number>()

  for (const file of files) {
    const role = fileRole(file.path)
    nodes.set(file.path, {
      id: file.path,
      label: file.path.split("/").pop() ?? file.path,
      folder: topFolder(file.path),
      language: file.language,
      role,
      connections: 0,
      inDegree: 0,
      outDegree: 0,
    })
    inDegree.set(file.path, 0)
    outDegree.set(file.path, 0)
  }

  const adjacency = new Map<string, Set<string>>()
  const reverseAdjacency = new Map<string, Set<string>>()
  for (const file of nodes.keys()) {
    adjacency.set(file, new Set())
    reverseAdjacency.set(file, new Set())
  }

  let totalImports = 0
  for (const edge of edges) {
    if (!nodes.has(edge.fromPath) || !nodes.has(edge.toPath)) continue
    if (edge.fromPath === edge.toPath) continue
    const key = edge.fromPath + "\x00" + edge.toPath
    // dedupe handled server-side, but be safe here too
    if (adjacency.get(edge.fromPath)!.has(edge.toPath)) continue
    adjacency.get(edge.fromPath)!.add(edge.toPath)
    reverseAdjacency.get(edge.toPath)!.add(edge.fromPath)
    outDegree.set(edge.fromPath, (outDegree.get(edge.fromPath) ?? 0) + 1)
    inDegree.set(edge.toPath, (inDegree.get(edge.toPath) ?? 0) + 1)
    totalImports++
  }

  for (const [path, node] of nodes) {
    const inDeg = inDegree.get(path) ?? 0
    const outDeg = outDegree.get(path) ?? 0
    node.inDegree = inDeg
    node.outDegree = outDeg
    node.connections = inDeg + outDeg
  }

  // folder aggregates
  const folders = new Map<string, FolderAgg>()
  for (const node of nodes.values()) {
    let agg = folders.get(node.folder)
    if (!agg) {
      agg = {
        folder: node.folder,
        fileCount: 0,
        roleMix: {} as Record<FileRole, number>,
        outgoingImports: 0,
        incomingImports: 0,
        hotspot: null,
      }
      for (const r of ROLE_ORDER) agg.roleMix[r] = 0
      folders.set(node.folder, agg)
    }
    agg.fileCount++
    agg.roleMix[node.role]++
  }
  for (const edge of edges) {
    if (!nodes.has(edge.fromPath) || !nodes.has(edge.toPath)) continue
    const fromFolder = nodes.get(edge.fromPath)!.folder
    const toFolder = nodes.get(edge.toPath)!.folder
    if (fromFolder !== toFolder) {
      folders.get(fromFolder)!.outgoingImports++
      folders.get(toFolder)!.incomingImports++
    }
  }
  for (const [folder, agg] of folders) {
    let best: NodeMeta | null = null
    for (const node of nodes.values()) {
      if (node.folder !== folder) continue
      if (!best || node.connections > best.connections) best = node
    }
    agg.hotspot = best
  }

  // SCCs (Tarjan) for cycles size >= 2
  const sccs = tarjanSCCs(nodes, adjacency)

  // orphans
  const orphans: string[] = []
  for (const [path, node] of nodes) {
    if (node.connections === 0) orphans.push(path)
  }
  orphans.sort()

  // hotspots top 10
  const hotspots = [...nodes.values()]
    .sort((a, b) => b.connections - a.connections || a.id.localeCompare(b.id))
    .slice(0, 10)

  return {
    nodes,
    adjacency,
    reverseAdjacency,
    inDegree,
    outDegree,
    folders,
    sccs,
    orphans,
    hotspots,
    totalFiles: nodes.size,
    totalEdges: edges.length,
    totalImports,
  }
}

function tarjanSCCs(
  nodes: Map<string, NodeMeta>,
  adjacency: Map<string, Set<string>>
): string[][] {
  const indexMap = new Map<string, number>()
  const lowlink = new Map<string, number>()
  const onStack = new Set<string>()
  const stack: string[] = []
  const sccs: string[][] = []
  let index = 0

  const strongconnect = (v: string) => {
    indexMap.set(v, index)
    lowlink.set(v, index)
    index++
    stack.push(v)
    onStack.add(v)

    for (const w of adjacency.get(v) ?? []) {
      if (!indexMap.has(w)) {
        strongconnect(w)
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!))
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indexMap.get(w)!))
      }
    }

    if (lowlink.get(v) === indexMap.get(v)) {
      const comp: string[] = []
      let w: string
      do {
        w = stack.pop()!
        onStack.delete(w)
        comp.push(w)
      } while (w !== v)
      if (comp.length >= 2) {
        sccs.push(comp.sort())
      }
    }
  }

  for (const v of nodes.keys()) {
    if (!indexMap.has(v)) strongconnect(v)
  }

  sccs.sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))
  return sccs
}

export type ImpactResult = {
  affected: { id: string; depth: number }[]
  direct: number
  indirect: number
  total: number
  apiRoutes: string[]
  pages: string[]
  serverActions: string[]
  testFiles: string[]
  folders: Map<string, { fileCount: number; testCount: number }>
}

export function impactAnalysis(
  model: GraphModel,
  changeSet: string[],
  maxDepth: number
): ImpactResult {
  const affected: { id: string; depth: number }[] = []
  const visited = new Set<string>()
  const queue: [string, number][] = []
  for (const id of changeSet) {
    if (model.nodes.has(id) && !visited.has(id)) {
      visited.add(id)
      queue.push([id, 0])
    }
  }

  while (queue.length > 0) {
    const [current, depth] = queue.shift()!
    if (depth >= maxDepth) continue
    const importers = model.reverseAdjacency.get(current)
    if (!importers) continue
    for (const next of importers) {
      if (visited.has(next)) continue
      visited.add(next)
      affected.push({ id: next, depth: depth + 1 })
      queue.push([next, depth + 1])
    }
  }

  affected.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))

  const direct = affected.filter((a) => a.depth === 1).length
  const indirect = affected.length - direct
  const total = affected.length

  const apiRoutes: string[] = []
  const pages: string[] = []
  const serverActions: string[] = []
  const testFiles: string[] = []
  const folders = new Map<string, { fileCount: number; testCount: number }>()

  for (const a of affected) {
    const node = model.nodes.get(a.id)
    if (!node) continue
    const agg = folders.get(node.folder) ?? { fileCount: 0, testCount: 0 }
    agg.fileCount++
    if (isTestFile(node.id)) agg.testCount++
    folders.set(node.folder, agg)

    if (node.role === "api-route") apiRoutes.push(node.id)
    else if (node.role === "page") pages.push(node.id)
    else if (node.role === "server-action") serverActions.push(node.id)
    if (isTestFile(node.id)) testFiles.push(node.id)
  }

  return { affected, direct, indirect, total, apiRoutes, pages, serverActions, testFiles, folders }
}

export function isTestFile(path: string): boolean {
  const lower = path.toLowerCase()
  return (
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("_test") ||
    path.includes("/tests/")
  )
}

export type RiskBreakdown = {
  score: number
  level: "Low" | "Medium" | "High"
  reasons: { label: string; points: number }[]
}

export function riskScore(
  model: GraphModel,
  changeSet: string[],
  maxDepth: number
): RiskBreakdown {
  const impact = impactAnalysis(model, changeSet, maxDepth)
  const reasons: { label: string; points: number }[] = []

  const dependentPoints = Math.min(50, impact.direct * 2.5)
  if (dependentPoints > 0) {
    reasons.push({ label: "Direct dependents", points: dependentPoints })
  }

  const reachApiOrPage =
    impact.apiRoutes.length + impact.pages.length + impact.serverActions.length
  const reachPoints = Math.min(20, reachApiOrPage * 4)
  if (reachPoints > 0) {
    reasons.push({ label: "Reaches API routes / pages", points: reachPoints })
  }

  const inCycle = model.sccs.some((comp) =>
    comp.some((id) => changeSet.includes(id))
  )
  if (inCycle) {
    reasons.push({ label: "Part of circular dependency", points: 10 })
  }

  const hotspotIds = new Set(model.hotspots.map((h) => h.id))
  const isHotspot = changeSet.some((id) => hotspotIds.has(id))
  if (isHotspot) {
    reasons.push({ label: "Top-10 hotspot", points: 10 })
  }

  const importerFolders = new Set<string>()
  for (const id of changeSet) {
    const node = model.nodes.get(id)
    if (!node) continue
    const importers = model.reverseAdjacency.get(id)
    if (importers) {
      for (const imp of importers) {
        const n = model.nodes.get(imp)
        if (n) importerFolders.add(n.folder)
      }
    }
  }
  const spreadPoints = Math.min(10, importerFolders.size * 2)
  if (spreadPoints > 0) {
    reasons.push({ label: "Importers across folders", points: spreadPoints })
  }

  let score = Math.round(
    dependentPoints + reachPoints + (inCycle ? 10 : 0) + (isHotspot ? 10 : 0) + spreadPoints
  )
  score = Math.min(100, Math.max(0, score))

  let level: "Low" | "Medium" | "High"
  if (score < 30) level = "Low"
  else if (score < 60) level = "Medium"
  else level = "High"

  return { score, level, reasons }
}

export type PaginationMeta = {
  total: number
  page: number
  pageSize: number
  totalPages: number
  start: number
  end: number
  hasPrev: boolean
  hasNext: boolean
}

export function paginate(
  total: number,
  page: number,
  pageSize: number
): PaginationMeta {
  const safePage = Math.max(1, page)
  const safePageSize = Math.max(1, pageSize)
  const totalPages = Math.max(1, Math.ceil(total / safePageSize))
  const clampedPage = Math.min(safePage, totalPages)
  const start = total === 0 ? 0 : (clampedPage - 1) * safePageSize + 1
  const end = Math.min(clampedPage * safePageSize, total)
  return {
    total,
    page: clampedPage,
    pageSize: safePageSize,
    totalPages,
    start,
    end,
    hasPrev: clampedPage > 1,
    hasNext: clampedPage < totalPages,
  }
}

export type URLState = {
  tab: string
  page: number
  pageSize: number
  search: string
  filter: string
  sort: string
  selected: string | null
  changeSet: string[]
}

export function parseURLState(searchParams: URLSearchParams): URLState {
  const tab = searchParams.get("tab") || "overview"
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1)
  const parsedPageSize = Number.parseInt(
    searchParams.get("pageSize") ?? "25",
    10
  )
  const pageSize = [25, 50, 100].includes(parsedPageSize) ? parsedPageSize : 25
  const search = searchParams.get("search") || ""
  const filter = searchParams.get("filter") || ""
  const sort = searchParams.get("sort") || "name"
  const selected = searchParams.get("selected") || null
  const changeSet = searchParams.get("changeSet")
    ? searchParams.get("changeSet")!.split(",").filter(Boolean)
    : []
  return { tab, page, pageSize, search, filter, sort, selected, changeSet }
}

export function writeURLState(
  base: string,
  state: Partial<URLState> & { tab?: string }
): string {
  const params = new URLSearchParams()
  if (state.tab) params.set("tab", state.tab)
  if (state.page !== undefined) params.set("page", String(state.page))
  if (state.pageSize !== undefined) params.set("pageSize", String(state.pageSize))
  if (state.search !== undefined) params.set("search", state.search)
  if (state.filter !== undefined) params.set("filter", state.filter)
  if (state.sort !== undefined) params.set("sort", state.sort)
  if (state.selected !== undefined) {
    if (state.selected === null) params.delete("selected")
    else params.set("selected", state.selected)
  }
  if (state.changeSet !== undefined) {
    if (state.changeSet.length === 0) params.delete("changeSet")
    else params.set("changeSet", state.changeSet.join(","))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

export function folderColorClass(folder: string): string {
  const hash = hashString(folder)
  return GRAPH_COLORS[hash % GRAPH_COLORS.length]
}

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function roleColorClass(role: FileRole): string {
  return GRAPH_COLORS[roleColorIndex(role)]
}
