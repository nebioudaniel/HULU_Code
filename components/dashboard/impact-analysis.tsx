"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Network, Search } from "lucide-react"

type Edge = { fromPath: string; toPath: string }

function topFolder(path: string): string {
  const segment = path.split("/")[0]
  return segment || path
}

function folderColor(folder: string): string {
  switch (folder) {
    case "app": return "bg-blue-50 border-blue-200 text-blue-700"
    case "components": return "bg-violet-50 border-violet-200 text-violet-700"
    case "lib": return "bg-emerald-50 border-emerald-200 text-emerald-700"
    case "cli": return "bg-orange-50 border-orange-200 text-orange-700"
    default: return "bg-slate-100 border-slate-200 text-slate-700"
  }
}

function isTestFile(path: string): boolean {
  const lower = path.toLowerCase()
  return lower.includes(".test.") || lower.includes("_test.") || lower.includes("/tests/")
}

export function ImpactAnalysis({ projectId }: { projectId: string }) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<string | null>(null)

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
        setError("Could not load impact data.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  const dependents = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const edge of edges) {
      if (!map.has(edge.toPath)) map.set(edge.toPath, new Set())
      map.get(edge.toPath)!.add(edge.fromPath)
    }
    return map
  }, [edges])

  const allFiles = useMemo(() => {
    const set = new Set<string>()
    for (const edge of edges) {
      set.add(edge.fromPath)
      set.add(edge.toPath)
    }
    return Array.from(set).sort()
  }, [edges])

  const bfs = useCallback((root: string) => {
    const visited = new Set<string>()
    const levels = new Map<string, number>()
    const queue: [string, number][] = [[root, 0]]
    visited.add(root)
    levels.set(root, 0)

    while (queue.length > 0) {
      const [current, depth] = queue.shift()!
      if (depth >= 3) continue
      const direct = dependents.get(current)
      if (!direct) continue
      for (const next of direct) {
        if (visited.has(next)) continue
        visited.add(next)
        levels.set(next, depth + 1)
        queue.push([next, depth + 1])
      }
    }

    visited.delete(root)
    const affected = Array.from(visited).map((id) => ({ id, depth: levels.get(id) ?? 0 }))
    affected.sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id))
    return affected
  }, [dependents])

  const riskyFiles = useMemo(() => {
    const counts = new Map<string, number>()
    for (const edge of edges) {
      counts.set(edge.toPath, (counts.get(edge.toPath) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
      .slice(0, 10)
  }, [edges])

  const riskBadge = (count: number) => {
    if (count > 15) return { label: "High", cls: "bg-rose-100 border-rose-200 text-rose-700" }
    if (count >= 5) return { label: "Medium", cls: "bg-amber-100 border-amber-200 text-amber-700" }
    return { label: "Low", cls: "bg-emerald-100 border-emerald-200 text-emerald-700" }
  }

  const affected = useMemo(() => {
    if (!selected) return []
    return bfs(selected)
  }, [selected, bfs])

  const matches = useMemo(() => {
    const term = search.toLowerCase()
    if (!term) return allFiles.slice(0, 20)
    return allFiles.filter((f) => f.toLowerCase().includes(term)).slice(0, 20)
  }, [search, allFiles])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Impact analysis</h2>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          Loading impact data…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground mb-3">Select a file</h3>
              <div className="space-y-1">
                <div className="relative">
                  <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" aria-hidden />
                  <Input
                    placeholder="Search files..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 h-8 text-xs border-input"
                  />
                </div>
                <div className="max-h-[300px] overflow-y-auto border border-input rounded-md bg-background text-sm">
                  {matches.length === 0 ? (
                    <p className="px-3 py-2 text-muted-foreground">No matching files</p>
                  ) : (
                    <ul>
                      {matches.map((file) => (
                        <li key={file} className="cursor-pointer select-none px-3 py-1.5 hover:bg-muted">
                          <button
                            onClick={() => setSelected(file)}
                            className="flex w-full items-center justify-between gap-2 text-left"
                          >
                            <span className="truncate min-w-0 font-medium text-foreground">{file}</span>
                            {selected === file && (
                              <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {riskyFiles.length > 0 && (
                <div className="mt-4 border-t border-input pt-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Top risky files</h4>
                  <ul className="space-y-1 mt-2 text-sm">
                    {riskyFiles.map(({ id, count }) => (
                      <li key={id} className="cursor-pointer select-none px-2 py-1 hover:bg-muted rounded">
                        <button
                          onClick={() => setSelected(id)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span className="truncate min-w-0 text-foreground">{id}</span>
                          <Badge variant="secondary" className="text-[10px]">{count}</Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            {!selected ? (
              <div className="rounded-xl border border-dashed border-border py-16 bg-background text-center text-muted-foreground">
                Select a file to see which files depend on it.
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Changing <span className="font-mono">{selected}</span> can affect <span className="font-semibold text-foreground">{affected.length}</span> file{affected.length === 1 ? "" : "s"}.</p>
                    <Badge {...riskBadge(affected.length)} className={riskBadge(affected.length).cls}>
                      {riskBadge(affected.length).label} impact
                    </Badge>
                  </div>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((depth) => {
                    const level = affected.filter((a) => a.depth === depth)
                    if (level.length === 0) return null
                    return (
                      <div key={depth} className="rounded-lg border border-input bg-muted/30 p-3">
                        <h4 className="text-xs font-semibold text-muted-foreground mb-2">
                          Depth {depth} (direct dependents){depth === 1 ? "" : ` (up to ${depth} steps away)`}
                        </h4>
                        <ul className="space-y-1">
                          {level.map((item) => (
                            <li key={item.id} className="flex items-center gap-2 text-sm">
                              <span className={`w-2 h-2 rounded-full ${folderColor(topFolder(item.id)).split(" ")[1]}`} aria-hidden />
                              <span className={`truncate min-w-0 ${isTestFile(item.id) ? "text-muted-foreground" : "text-foreground"}`}>{item.id}</span>
                              {isTestFile(item.id) && (
                                <span className="ml-auto text-[10px] font-medium text-emerald-600 bg-emerald-50/50 px-1.5 py-0.5 rounded">likely to need re-running</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
