"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChevronDown,
  Maximize,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

type Edge = { fromPath: string; toPath: string }

type NodeData = SimulationNodeDatum & {
  id: string
  label: string
  folder?: string
  language?: string
  connections: number
}

type LinkData = SimulationLinkDatum<NodeData>

function topFolder(path: string): string {
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

export function DependencyMap({ projectId }: { projectId: string }) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<"folders" | "files">("folders")
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [selected, setSelected] = useState<NodeData | null>(null)
  const [search, setSearch] = useState("")
  const [showList, setShowList] = useState(false)
  const [truncated, setTruncated] = useState(false)
  const [tick, setTick] = useState(0)
  const [transform, setTransform] = useState({ k: 1, x: 0, y: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<NodeData, LinkData> | null>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/projects/${projectId}/edges`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load edges")
        return res.json()
      })
      .then((data: { edges?: Edge[]; truncated?: boolean }) => {
        if (cancelled) return
        setEdges(data.edges ?? [])
        setTruncated(Boolean(data.truncated))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load the dependency map.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of edges) {
      if (!map.has(edge.fromPath)) map.set(edge.fromPath, new Set())
      if (!map.has(edge.toPath)) map.set(edge.toPath, new Set())
      map.get(edge.fromPath)!.add(edge.toPath)
      map.get(edge.toPath)!.add(edge.fromPath)
    }
    return map
  }, [edges])

  const nodeMap = useMemo<Map<string, NodeData>>(() => {
    const map = new Map<string, NodeData>()
    const conn = new Map<string, number>()
    for (const edge of edges) {
      conn.set(edge.fromPath, (conn.get(edge.fromPath) ?? 0) + 1)
      conn.set(edge.toPath, (conn.get(edge.toPath) ?? 0) + 1)
    }
    for (const [id, count] of conn) {
      map.set(id, {
        id,
        label: id,
        folder: topFolder(id),
        language: languageOf(id),
        connections: count,
      })
    }
    return map
  }, [edges])

  const nodes = useMemo<NodeData[]>(() => Array.from(nodeMap.values()), [nodeMap])

  const links = useMemo<LinkData[]>(() => {
    const counts = new Map<string, number>()
    for (const edge of edges) {
      const key = `${edge.fromPath}\x00${edge.toPath}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([key, value]) => {
      const [sourceId, targetId] = key.split("\x00")
      return {
        source: nodeMap.get(sourceId)!,
        target: nodeMap.get(targetId)!,
      }
    })
  }, [edges, nodeMap])

  const linkWidths = useMemo(() => {
    const map = new Map<string, number>()
    for (const edge of edges) {
      const key = `${edge.fromPath}\x00${edge.toPath}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return map
  }, [edges])

  const hotspots = useMemo(() => {
    return [...nodes].sort((a, b) => b.connections - a.connections).slice(0, 5)
  }, [nodes])

  const filteredNodes = useMemo(() => {
    const term = search.toLowerCase()
    if (!term) return nodes
    return nodes.filter((n) => n.label.toLowerCase().includes(term))
  }, [nodes, search])

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>()
    for (const node of nodes) {
      map.set(node.id, { x: Number(node.x) || 350, y: Number(node.y) || 225 })
    }
    return map
  }, [nodes, tick])

  const isNeighbor = (id: string) => {
    if (!highlighted) return false
    return id === highlighted || Boolean(adjacency.get(highlighted)?.has(id))
  }

  const nodeColor = useMemo(() => {
    return (node: NodeData) => {
      if (view === "folders") {
        switch (node.folder) {
          case "app": return { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" }
          case "components": return { text: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" }
          case "lib": return { text: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" }
          case "cli": return { text: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" }
          default: return { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" }
        }
      }
      switch (node.language) {
        case "TypeScript": return { text: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" }
        case "JavaScript": return { text: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" }
        case "Go": return { text: "text-cyan-600", bg: "bg-cyan-50", border: "border-cyan-200" }
        case "Python": return { text: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" }
        default: return { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" }
      }
    }
  }, [view])

  useEffect(() => {
    const width = 700
    const height = 450
    const simulation = forceSimulation<NodeData, LinkData>(nodes)
      .force(
        "link",
        forceLink<NodeData, LinkData>(links).id((d: NodeData) => d.id)
          .strength(0.08)
          .distance(70)
      )
      .force("charge", forceManyBody().strength(-50))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius(16).iterations(2))
      .on("tick", () => {
        simRef.current = simulation
        setTick((t) => t + 1)
      })

    simRef.current = simulation
    return () => {
      simulation.stop()
      simRef.current = null
    }
  }, [view, nodes, links])

  useEffect(() => {
    if (simRef.current === null) return
    frameRef.current = requestAnimationFrame(() => {
      setTick((t) => t + 1)
    })
    return () => cancelAnimationFrame(frameRef.current)
  }, [tick])

  function zoomIn() {
    setTransform((t) => ({ k: Math.min(2, t.k + 0.2), x: t.x, y: t.y }))
  }
  function zoomOut() {
    setTransform((t) => ({ k: Math.max(0.4, t.k - 0.2), x: t.x, y: t.y }))
  }
  function resetZoom() {
    setTransform({ k: 1, x: 0, y: 0 })
  }

  function handleNodeClick(node: NodeData) {
    setSelected(selected?.id === node.id ? null : node)
    setHighlighted(selected?.id === node.id ? null : node.id)
  }

  function getRadius(node: NodeData): number {
    return Math.max(6, Math.min(16, 5 + Math.log1p(node.connections) * 3))
  }

  function sx(n: NodeData): number {
    return Number(n.x) || 350
  }
  function sy(n: NodeData): number {
    return Number(n.y) || 225
  }
  function nodeId(n: NodeData | string | number): string {
    return typeof n === "string" || typeof n === "number" ? String(n) : n.id
  }
  function truncateLabel(label: string): string {
    return label.length > 20 ? label.slice(0, 17) + "…" : label
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Dependency map</h2>
        </div>
        <div className="ml-auto flex flex-col sm:flex-row items-end gap-2">
          <div className="flex items-center gap-1.5">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <Input
              placeholder="Search files or folders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[210px] text-xs border-input"
            />
          </div>
          <div className="flex items-center gap-1 border border-input rounded-lg p-1">
            <button
              onClick={() => setView("folders")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${view === "folders" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              Folders
            </button>
            <button
              onClick={() => setView("files")}
              className={`px-2 py-1 text-xs rounded-md transition-colors ${view === "files" ? "bg-blue-600 text-white" : "text-muted-foreground hover:bg-muted"}`}
            >
              Files
            </button>
          </div>
          <Button
            onClick={() => setShowList(!showList)}
            size="sm"
            className="flex items-center gap-1.5 text-xs"
          >
            {showList ? (
              <>
                <ChevronDown className="size-3.5" aria-hidden />
                Graph view
              </>
            ) : (
              <>
                <Table className="size-3.5" aria-hidden />
                List view
              </>
            )}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          Loading dependency map…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <Button size="icon-sm" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn className="size-3.5" />
            </Button>
            <Button size="icon-sm" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut className="size-3.5" />
            </Button>
            <Button size="icon-sm" onClick={resetZoom} aria-label="Reset zoom">
              <Maximize className="size-3.5" />
            </Button>
          </div>
          <svg
            ref={svgRef}
            className="w-full h-[450px] rounded-lg border border-background/50 bg-background"
            viewBox="0 0 700 450"
            preserveAspectRatio="xMidYMid meet"
            style={{
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
              transformOrigin: "top left",
              willChange: "transform",
            }}
          >
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
              </marker>
            </defs>
            <g>
              {links.map((link) => {
                const src = nodeId(link.source)
                const dst = nodeId(link.target)
                const hi = isNeighbor(src) || isNeighbor(dst)
                const a = positions.get(src) ?? { x: 350, y: 225 }
                const b = positions.get(dst) ?? { x: 350, y: 225 }
                return (
                  <path
                    key={`${src}-${dst}`}
                    d={`M${a.x},${a.y} Q${((a.x + b.x) / 2).toFixed(0)},${((a.y + b.y) / 2).toFixed(0)} ${b.x},${b.y}`}
                    stroke="#cbd5e1"
                    strokeWidth={Math.max(1, Math.min(5, (linkWidths.get(`${src}-${dst}`) ?? 1) / 3))}
                    strokeOpacity={0.45}
                    fill="none"
                    marker-end="url(#arrow)"
                    className="transition-all duration-300"
                    style={{
                      strokeOpacity: highlighted && !hi ? 0.12 : 0.45,
                      stroke: highlighted && hi ? "#2563eb" : "#cbd5e1",
                    }}
                  />
                )
              })}
              {filteredNodes.map((node) => {
                const isHi = isNeighbor(node.id)
                const isHotspot = hotspots.some((h) => h.id === node.id)
                const isSelected = selected?.id === node.id
                const { bg, border } = nodeColor(node)
                const radius = getRadius(node)
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform duration-200"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNodeClick(node)
                    }}
                    onMouseEnter={() => setHighlighted(node.id)}
                    onMouseLeave={() => setHighlighted(null)}
                    transform={`translate(${node.x ?? 350},${node.y ?? 225})`}
                  >
                    <circle
                      r={radius}
                      fill={bg}
                      stroke={border}
                      strokeWidth="1.5"
                      className="transition-all duration-300"
                      style={{
                        opacity: highlighted && !isHi ? 0.4 : 1,
                        strokeOpacity: isSelected ? 0.9 : 0.8,
                      }}
                    />
                    <text
                      x={radius + 5}
                      y={5}
                      fontSize="9"
                      fill="#334155"
                      className="font-medium"
                      pointerEvents="none"
                    >
                      {truncateLabel(node.label)}
                    </text>
                    {isHotspot && (
                      <circle r={radius + 4} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.7} />
                    )}
                    {isSelected && (
                      <circle r={radius + 6} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5 5" />
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      )}

      {truncated && (
        <p className="text-xs text-muted-foreground">
          Showing up to 1,500 edges. The full graph may be larger.
        </p>
      )}

      {hotspots.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 mb-3">
            <Network className="size-3.5 text-muted-foreground" aria-hidden />
            <h3 className="text-sm font-semibold text-foreground">Hotspots (most connected)</h3>
          </div>
          <ul className="space-y-2 text-sm">
            {hotspots.map((node) => (
              <li key={node.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${nodeColor(node).bg}`} aria-hidden />
                <span className="truncate min-w-0 font-medium text-foreground">{node.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{node.connections}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showList && (
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">File</TableHead>
                <TableHead className="px-4">Imports</TableHead>
                <TableHead className="px-4">Imported by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNodes.map((node) => (
                <TableRow key={node.id}>
                  <TableCell className="px-4 font-medium truncate max-w-[40%]">{node.label}</TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {adjacency.get(node.id)?.size ?? 0}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {adjacency.get(node.id)?.size ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {selected && (
        <Sheet open={Boolean(selected)}>
          <SheetTrigger asChild>
            <button className="hidden" />
          </SheetTrigger>
          <SheetContent side="right" className="max-w-md">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{selected.label}</h3>
              <Button variant="ghost" size="icon-sm" onClick={() => setSelected(null)} />
            </div>
            <p className="text-xs text-muted-foreground">
              {selected.connections} connection{selected.connections === 1 ? "" : "s"}
            </p>
            <div className="mt-4 space-y-2">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Connected files</h4>
              <ul className="space-y-1 text-sm">
                {[...(adjacency.get(selected.id) ?? [])].map((target) => (
                  <li key={target}>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-left truncate"
                        onClick={() => setSelected(nodeMap.get(target) ?? null)}
                      >
                        {target}
                      </Button>
                    </SheetTrigger>
                  </li>
                ))}
              </ul>
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
