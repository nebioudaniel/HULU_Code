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
import { zoomIdentity } from "d3-zoom"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  Maximize,
  Network,
  Search,
  ZoomIn,
  ZoomOut,
} from "lucide-react"

import { fileRole, roleColorClass, type FileRole } from "@/lib/graph"

type Edge = { fromPath: string; toPath: string }

type NodeData = SimulationNodeDatum & {
  id: string
  label: string
  folder: string
  language: string
  role: FileRole
  connections: number
}

type LinkData = SimulationLinkDatum<NodeData> & { value: number }

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

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

export function DependencyMap({ projectId }: { projectId: string }) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [highlighted, setHighlighted] = useState<string | null>(null)
  const [selected, setSelected] = useState<NodeData | null>(null)
  const [search, setSearch] = useState("")
  const [zoomTransform, setZoomTransform] = useState(zoomIdentity)
  const [isPanning, setIsPanning] = useState(false)
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<Simulation<NodeData, SimulationLinkDatum<NodeData>> | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v1/projects/${projectId}/edges`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load edges")
        return res.json()
      })
      .then((data: { edges?: Edge[] }) => {
        if (cancelled) return
        setEdges(data.edges ?? [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError(true)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const adjacency = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!map.has(e.fromPath)) map.set(e.fromPath, new Set())
      if (!map.has(e.toPath)) map.set(e.toPath, new Set())
      map.get(e.fromPath)!.add(e.toPath)
      map.get(e.toPath)!.add(e.fromPath)
    }
    return map
  }, [edges])

  const nodeMap = useMemo(() => {
    const map = new Map<string, NodeData>()
    const conn = new Map<string, number>()
    for (const e of edges) {
      conn.set(e.fromPath, (conn.get(e.fromPath) ?? 0) + 1)
      conn.set(e.toPath, (conn.get(e.toPath) ?? 0) + 1)
    }
    for (const [id, count] of conn) {
      map.set(id, {
        id,
        label: id.split("/").pop() ?? id,
        folder: topFolder(id),
        language: languageOf(id),
        role: fileRole(id),
        connections: count,
      })
    }
    return map
  }, [edges])

  const nodes = useMemo(() => Array.from(nodeMap.values()), [nodeMap])

  const links = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of edges) {
      const key = `${e.fromPath}\x00${e.toPath}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([key, value]) => {
      const [sId, tId] = key.split("\x00")
      return {
        source: nodeMap.get(sId)!,
        target: nodeMap.get(tId)!,
        value,
      }
    })
  }, [edges, nodeMap])

  const hotspots = useMemo(() => {
    return [...nodes].sort((a, b) => b.connections - a.connections).slice(0, 10)
  }, [nodes])

  const searchMatches = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return null
    return new Set(
      nodes
        .filter(
          (n) =>
            n.label.toLowerCase().includes(term) ||
            n.folder.toLowerCase().includes(term)
        )
        .map((n) => n.id)
    )
  }, [nodes, search])

  const isNeighbor = (id: string) => {
    if (!highlighted) return false
    return id === highlighted || Boolean(adjacency.get(highlighted)?.has(id))
  }

  useEffect(() => {
    if (prefersReducedMotion() || nodes.length === 0) return
    const width = 700
    const height = 450
    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<NodeData, LinkData>(links)
          .id((d: NodeData) => d.id)
          .strength(0.06)
          .distance(60)
      )
      .force("charge", forceManyBody().strength(-40))
      .force("center", forceCenter(width / 2, height / 2))
      .force("collide", forceCollide().radius(14).iterations(2))
      .on("tick", () => {
        simRef.current = simulation
      })

    simRef.current = simulation
    return () => {
      simulation.stop()
      simRef.current = null
    }
  }, [nodes, links])

  const nodeColor = useMemo(
    () => (node: NodeData) => {
      const color = roleColorClass(node.role)
      return { bg: color, border: color, text: color }
    },
    []
  )

  const handleNodeClick = (node: NodeData) => {
    setSelected(selected?.id === node.id ? null : node)
    setHighlighted(selected?.id === node.id ? null : node.id)
  }

  const getRadius = (node: NodeData) =>
    Math.max(6, Math.min(16, 5 + Math.log1p(node.connections) * 2.5))

  const sx = (n: NodeData) => Number(n.x) || 350
  const sy = (n: NodeData) => Number(n.y) || 225

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.9 : 1.1
    setZoomTransform((t) => {
      const k = Math.min(2, Math.max(0.4, t.k * factor))
      return zoomIdentity.translate(t.x, t.y).scale(k)
    })
  }

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsPanning(true)
    setLastPos({ x: e.clientX, y: e.clientY })
  }

  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isPanning) return
    setZoomTransform((t) => {
      const dx = e.clientX - lastPos.x
      const dy = e.clientY - lastPos.y
      setLastPos({ x: e.clientX, y: e.clientY })
      return t.translate(t.x + dx, t.y + dy)
    })
  }

  const onMouseUp = () => setIsPanning(false)

  const resetZoom = () => setZoomTransform(zoomIdentity)

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
              className="h-8 w-[210px] text-xs border border-input"
            />
          </div>
          <Button
            onClick={() => setSelected(null)}
            size="sm"
            className="flex items-center gap-1.5 text-xs"
          >
            <ChevronDown className="size-3.5" aria-hidden />
            Clear selection
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
          Could not load the dependency map.
        </div>
      )}

      {!loading && !error && (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10 flex gap-1">
            <Button
              size="icon-sm"
              onClick={() =>
                setZoomTransform((t) =>
                  zoomIdentity.translate(t.x, t.y).scale(Math.min(2, t.k * 1.2))
                )
              }
              aria-label="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </Button>
            <Button
              size="icon-sm"
              onClick={() =>
                setZoomTransform((t) =>
                  zoomIdentity.translate(t.x, t.y).scale(Math.max(0.4, t.k / 1.2))
                )
              }
              aria-label="Zoom out"
            >
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
            onWheel={onWheel}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            style={{ cursor: isPanning ? "grabbing" : "grab" }}
          >
            <defs>
              <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                <path d="M0,0 L0,6 L6,3 z" fill="#94a3b8" />
              </marker>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <g transform={zoomTransform.toString()}>
              {links.map((link) => {
                const hi = isNeighbor(link.source.id) || isNeighbor(link.target.id)
                return (
                  <path
                    key={`${link.source.id}-${link.target.id}`}
                    d={`M${sx(link.source)},${sy(link.source)} Q${((sx(link.source) + sx(link.target)) / 2).toFixed(0)},${(sy(link.source) + sy(link.target)) / 2} ${sx(link.target)},${sy(link.target)}`}
                    stroke="#cbd5e1"
                    strokeWidth={Math.max(1, Math.min(5, (link.value ?? 1) / 3))}
                    strokeOpacity={0.35}
                    fill="none"
                    marker-end="url(#arrow)"
                    className="transition-all duration-300"
                    style={{
                      strokeOpacity: highlighted && !hi ? 0.1 : 0.35,
                      stroke: highlighted && hi ? "#2563eb" : "#cbd5e1",
                    }}
                  />
                )
              })}
              {nodes.map((node) => {
                const isHi = isNeighbor(node.id)
                const isHotspot = hotspots.some((h) => h.id === node.id)
                const isSelected = selected?.id === node.id
                const dimmedBySearch = searchMatches !== null && !searchMatches.has(node.id)
                const { bg, border } = nodeColor(node)
                const radius = getRadius(node)
                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform duration-300"
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
                        opacity: dimmedBySearch || (highlighted && !isHi) ? 0.15 : 1,
                        strokeOpacity: isSelected ? 0.9 : 0.7,
                        filter: isSelected || isHotspot ? "url(#glow)" : undefined,
                      }}
                    />
                    <text
                      x={radius + 6}
                      y={5}
                      fontSize="9"
                      fill="#334155"
                      className="font-medium"
                      pointerEvents="none"
                    >
                      {node.label.length > 18 ? node.label.slice(0, 15) + "…" : node.label}
                    </text>
                    {isHotspot && (
                      <circle r={radius + 5} fill="none" stroke="#2563eb" strokeWidth={2} opacity={0.7} />
                    )}
                    {isSelected && (
                      <circle r={radius + 7} fill="none" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5 5" />
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
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
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: nodeColor(node).bg }}
                  aria-hidden
                />
                <span className="truncate min-w-0 font-medium text-foreground">{node.label}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">{node.connections}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
