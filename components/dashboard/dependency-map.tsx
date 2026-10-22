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
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Maximize,
  Network,
  Search,
  Zap,
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

function roleArticle(role: FileRole): string {
  switch (role) {
    case "api-route":
      return "an API route"
    case "page":
      return "a page"
    case "layout":
      return "a layout"
    case "server-action":
      return "a server action"
    case "component":
      return "a component"
    case "ui-primitive":
      return "a UI primitive"
    case "hook":
      return "a hook"
    case "type-definitions":
      return "a type definition file"
    case "config":
      return "a configuration file"
    case "test":
      return "a test file"
    case "cli":
      return "a CLI file"
    case "backend":
      return "a backend file"
    default:
      return "a source file"
  }
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
  const [symbols, setSymbols] = useState<{ kind: string; name: string; parent: string; startLine: number; endLine: number }[]>([])
  const [symbolsLoading, setSymbolsLoading] = useState(false)
  const [copied, setCopied] = useState(false)

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

  const outgoing = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!map.has(e.fromPath)) map.set(e.fromPath, new Set())
      map.get(e.fromPath)!.add(e.toPath)
    }
    return map
  }, [edges])

  const incoming = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const e of edges) {
      if (!map.has(e.toPath)) map.set(e.toPath, new Set())
      map.get(e.toPath)!.add(e.fromPath)
    }
    return map
  }, [edges])

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selected) {
      setSymbols([])
      return
    }
    let cancelled = false
    setSymbolsLoading(true)
    fetch(`/api/v1/projects/${projectId}/files?path=${encodeURIComponent(selected.id)}`)
      .then((res) => (res.ok ? res.json() : { chunks: [] }))
      .then((data: { chunks?: { kind: string; name: string; parent: string; startLine: number; endLine: number }[] }) => {
        if (!cancelled) setSymbols(data.chunks ?? [])
      })
      .catch(() => {
        if (!cancelled) setSymbols([])
      })
      .finally(() => {
        if (!cancelled) setSymbolsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selected, projectId])
  /* eslint-enable react-hooks/set-state-in-effect */

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

  const selectNode = (id: string) => {
    const node = nodeMap.get(id)
    if (node) {
      setSelected(node)
      setHighlighted(node.id)
    }
  }

  const isHotspotNode = (id: string) => hotspots.some((h) => h.id === id)

  const describeNode = (node: NodeData, imports: number, importedBy: number) => {
    const parts: string[] = []
    parts.push(`This is ${roleArticle(node.role)} in the ${node.folder} area.`)
    if (imports > 0) {
      parts.push(`It imports ${imports} file${imports === 1 ? "" : "s"}.`)
    }
    if (importedBy > 0) {
      parts.push(`${importedBy} file${importedBy === 1 ? "" : "s"} import it.`)
    } else {
      parts.push("Nothing imports it, so it may be an entry point or unused.")
    }
    if (isHotspotNode(node.id)) {
      parts.push("It is one of the most connected files, so changes here can ripple widely.")
    }
    return parts.join(" ")
  }

  const copyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  const goToImpact = (path: string) => {
    const params = new URLSearchParams(window.location.search)
    params.set("tab", "impact")
    params.set("changeSet", path)
    window.location.assign(`${window.location.pathname}?${params.toString()}`)
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
                <button
                  type="button"
                  onClick={() => selectNode(node.id)}
                  className="truncate min-w-0 font-medium text-foreground hover:underline"
                >
                  {node.label}
                </button>
                <span className="ml-auto text-muted-foreground tabular-nums">{node.connections}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {selected && (() => {
            const imports = Array.from(outgoing.get(selected.id) ?? [])
            const importedBy = Array.from(incoming.get(selected.id) ?? [])
            const color = roleColorClass(selected.role)
            return (
              <>
                <SheetHeader className="border-b border-border pb-4">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="text-[10px]"
                      style={{ color, borderColor: color }}
                    >
                      {selected.role}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px]">
                      {selected.language}
                    </Badge>
                    {isHotspotNode(selected.id) && (
                      <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                        <Zap className="size-3" />
                        Hotspot
                      </Badge>
                    )}
                  </div>
                  <SheetTitle className="break-all font-mono text-sm">
                    {selected.id}
                  </SheetTitle>
                  <SheetDescription>
                    {describeNode(selected, imports.length, importedBy.length)}
                  </SheetDescription>
                </SheetHeader>

                <div className="space-y-5 p-4">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">Connections</p>
                      <p className="text-lg font-semibold tabular-nums">{selected.connections}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">Imports</p>
                      <p className="text-lg font-semibold tabular-nums">{imports.length}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/40 p-3">
                      <p className="text-[11px] text-muted-foreground">Imported by</p>
                      <p className="text-lg font-semibold tabular-nums">{importedBy.length}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyPath(selected.id)}>
                      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                      {copied ? "Copied" : "Copy path"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => goToImpact(selected.id)}>
                      <Zap className="size-3.5" />
                      View impact
                    </Button>
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden />
                      Imports ({imports.length})
                    </h4>
                    {imports.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No outgoing imports.</p>
                    ) : (
                      <ul className="space-y-1">
                        {imports.slice(0, 30).map((path) => (
                          <li key={path}>
                            <button
                              type="button"
                              onClick={() => selectNode(path)}
                              className="w-full truncate rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs hover:bg-muted"
                            >
                              {path}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <ArrowDownLeft className="size-3.5 text-muted-foreground" aria-hidden />
                      Imported by ({importedBy.length})
                    </h4>
                    {importedBy.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Nothing imports this file. It may be an entry point or unused.
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {importedBy.slice(0, 30).map((path) => (
                          <li key={path}>
                            <button
                              type="button"
                              onClick={() => selectNode(path)}
                              className="w-full truncate rounded-md border border-border bg-card px-2 py-1.5 text-left text-xs hover:bg-muted"
                            >
                              {path}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h4 className="mb-2 text-xs font-semibold text-foreground">
                      Symbols {symbolsLoading ? "" : `(${symbols.length})`}
                    </h4>
                    {symbolsLoading ? (
                      <p className="text-xs text-muted-foreground">Loading symbols…</p>
                    ) : symbols.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No symbols found in this file.</p>
                    ) : (
                      <ul className="space-y-1">
                        {symbols.slice(0, 40).map((sym, index) => (
                          <li
                            key={`${sym.name}-${sym.startLine}-${index}`}
                            className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                          >
                            <Badge variant="secondary" className="text-[10px]">
                              {sym.kind}
                            </Badge>
                            <span className="truncate font-medium text-foreground">
                              {sym.parent ? `${sym.parent}.${sym.name}` : sym.name}
                            </span>
                            <span className="ml-auto tabular-nums text-muted-foreground">
                              {sym.startLine}-{sym.endLine}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
