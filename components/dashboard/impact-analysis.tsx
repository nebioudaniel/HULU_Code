"use client"

import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Copy,
  GitCompareArrows,
  Link2,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  buildGraphModel,
  fileRole,
  impactAnalysis,
  isTestFile,
  riskScore,
  roleColorClass,
  topFolder,
  type GraphModel,
  type ImpactResult,
  type RiskBreakdown,
} from "@/lib/graph"

type Edge = { fromPath: string; toPath: string }

export function AiExplainButton() {
  return null
}

function RoleBadge({ path }: { path: string }) {
  const role = fileRole(path)
  const color = roleColorClass(role)
  return (
    <Badge
      variant="outline"
      className="text-[10px]"
      style={{ color, borderColor: color }}
    >
      {role}
    </Badge>
  )
}

function shorten(path: string, max = 44): string {
  if (path.length <= max) return path
  const parts = path.split("/")
  if (parts.length <= 2) return path.slice(0, max - 1) + "…"
  const head = parts[0]
  const tail = parts.slice(-2).join("/")
  const candidate = `${head}/…/${tail}`
  return candidate.length <= max ? candidate : path.slice(0, max - 1) + "…"
}

export function ImpactAnalysis({ projectId }: { projectId: string }) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [changeSet, setChangeSet] = useState<string[]>([])
  const [depth, setDepth] = useState(4)
  const [query, setQuery] = useState("")
  const [showPicker, setShowPicker] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

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

  const model: GraphModel = useMemo(
    () =>
      buildGraphModel(
        Array.from(
          new Set(edges.flatMap((e) => [e.fromPath, e.toPath]))
        ).map((path) => ({
          path,
          language: "",
          lineCount: 0,
          partial: false,
          chunkCount: 0,
        })),
        edges
      ),
    [edges]
  )

  const impact: ImpactResult = useMemo(
    () => impactAnalysis(model, changeSet, depth),
    [model, changeSet, depth]
  )

  const risk: RiskBreakdown = useMemo(
    () => riskScore(model, changeSet, depth),
    [model, changeSet, depth]
  )

  const pickerResults = useMemo(() => {
    const term = query.trim().toLowerCase()
    const all = Array.from(model.nodes.values())
    const list = term
      ? all.filter((n) => n.id.toLowerCase().includes(term))
      : all
    return list.slice(0, 60)
  }, [model, query])

  const toggleFile = (path: string) => {
    setChangeSet((current) =>
      current.includes(path)
        ? current.filter((p) => p !== path)
        : [...current, path]
    )
  }

  const copy = async (kind: "checklist" | "link") => {
    let text = ""
    if (kind === "link") {
      const url = `${window.location.origin}${window.location.pathname}?tab=impact&changeSet=${encodeURIComponent(changeSet.join(","))}`
      text = url
    } else {
      const lines: string[] = []
      lines.push("# Change impact checklist")
      lines.push("")
      lines.push(`Risk: ${risk.level} (${risk.score}/100)`)
      lines.push("")
      lines.push("## Changed files")
      for (const f of changeSet) lines.push(`- ${f}`)
      lines.push("")
      lines.push("## Affected files")
      for (const a of impact.affected.slice(0, 100)) {
        lines.push(`- [ ] ${a.id} (depth ${a.depth})`)
      }
      if (impact.testFiles.length > 0) {
        lines.push("")
        lines.push("## Tests to re-run")
        for (const t of impact.testFiles) lines.push(`- [ ] ${t}`)
      }
      lines.push("")
      lines.push("## Why this score")
      for (const r of risk.reasons) lines.push(`- ${r.label}: ${r.points}`)
      text = lines.join("\n")
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  const byDepth = useMemo(() => {
    const groups = new Map<number, string[]>()
    for (const a of impact.affected) {
      const list = groups.get(a.depth) ?? []
      list.push(a.id)
      groups.set(a.depth, list)
    }
    return Array.from(groups.entries()).sort((a, b) => a[0] - b[0])
  }, [impact])

  const risky = useMemo(() => {
    return Array.from(model.nodes.values())
      .map((n) => ({ id: n.id, risk: riskScore(model, [n.id], 4) }))
      .sort((a, b) => b.risk.score - a.risk.score || a.id.localeCompare(b.id))
      .slice(0, 10)
  }, [model])

  const safe = useMemo(() => {
    return Array.from(model.nodes.values())
      .filter((n) => (model.reverseAdjacency.get(n.id)?.size ?? 0) === 0)
      .filter((n) => fileRole(n.id) !== "api-route" && fileRole(n.id) !== "page" && fileRole(n.id) !== "layout")
      .slice(0, 12)
  }, [model])

  const unused = useMemo(() => {
    return Array.from(model.nodes.values())
      .filter((n) => (model.reverseAdjacency.get(n.id)?.size ?? 0) === 0)
      .filter((n) => {
        const role = fileRole(n.id)
        if (role === "api-route" || role === "page" || role === "layout") return false
        if (isTestFile(n.id)) return false
        if (role === "type-definitions" || role === "config") return false
        return true
      })
      .slice(0, 12)
  }, [model])

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        Could not load the impact analysis.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Impact analysis</h2>
        </div>
        <div className="flex items-center gap-2">
          <AiExplainButton />
          <Button size="sm" variant="outline" onClick={() => copy("link")}>
            {copied === "link" ? (
              <Check className="size-3.5" />
            ) : (
              <Link2 className="size-3.5" />
            )}
            Copy link
          </Button>
          <Button
            size="sm"
            onClick={() => copy("checklist")}
            disabled={changeSet.length === 0}
          >
            {copied === "checklist" ? (
              <Check className="size-3.5" />
            ) : (
              <Copy className="size-3.5" />
            )}
            Copy PR checklist
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          {changeSet.map((path) => (
            <Badge key={path} variant="secondary" className="gap-1">
              {shorten(path, 28)}
              <button
                type="button"
                onClick={() => toggleFile(path)}
                aria-label={`Remove ${path}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPicker((v) => !v)}
          >
            <Search className="size-3.5" />
            {changeSet.length === 0 ? "Select files" : "Add files"}
          </Button>
        </div>

        {showPicker && (
          <div className="mt-3 space-y-2">
            <Input
              autoFocus
              placeholder="Search files…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-xs"
            />
            <ul className="max-h-64 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {pickerResults.map((node) => {
                const selected = changeSet.includes(node.id)
                return (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => toggleFile(node.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted"
                    >
                      <span
                        className={`flex size-4 items-center justify-center rounded-sm border ${
                          selected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-input"
                        }`}
                      >
                        {selected && <Check className="size-3" />}
                      </span>
                      <span className="truncate">{shorten(node.id, 50)}</span>
                      <span className="ml-auto">
                        <RoleBadge path={node.id} />
                      </span>
                    </button>
                  </li>
                )
              })}
              {pickerResults.length === 0 && (
                <li className="px-3 py-4 text-xs text-muted-foreground">
                  No matching files.
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Depth</span>
          {[1, 2, 3, 4].map((d) => (
            <Button
              key={d}
              size="sm"
              variant={depth === d ? "default" : "outline"}
              onClick={() => setDepth(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </div>

      {changeSet.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Select one or more files to see what a change would affect.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Direct</p>
              <p className="text-2xl font-semibold tabular-nums">{impact.direct}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Indirect</p>
              <p className="text-2xl font-semibold tabular-nums">{impact.indirect}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Total affected</p>
              <p className="text-2xl font-semibold tabular-nums">{impact.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Folders</p>
              <p className="text-2xl font-semibold tabular-nums">{impact.folders.size}</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Risk score</h3>
                <Badge
                  variant={
                    risk.level === "High"
                      ? "destructive"
                      : risk.level === "Medium"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {risk.level}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-3xl font-semibold tabular-nums">
                  {risk.score}
                </span>
                <span className="text-sm text-muted-foreground">/ 100</span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {risk.reasons.length === 0 && <li>No risk factors detected.</li>}
                {risk.reasons.map((r) => (
                  <li key={r.label} className="flex items-center justify-between gap-2">
                    <span>{r.label}</span>
                    <span className="tabular-nums text-foreground">+{r.points}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground">
                Entry points affected
              </h3>
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">API routes</span>
                  <span className="tabular-nums">{impact.apiRoutes.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Pages</span>
                  <span className="tabular-nums">{impact.pages.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Server actions</span>
                  <span className="tabular-nums">{impact.serverActions.length}</span>
                </div>
              </div>
              {impact.apiRoutes.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {impact.apiRoutes.slice(0, 5).map((p) => (
                    <li key={p} className="truncate text-xs text-muted-foreground">
                      {shorten(p, 40)}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {impact.testFiles.length > 0 ? (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground">Re-run these tests</h3>
              <ul className="mt-2 space-y-1 text-xs">
                {impact.testFiles.map((t) => (
                  <li key={t} className="truncate text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No test files were found among the dependents.
            </p>
          )}

          <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
            <h3 className="text-sm font-semibold text-foreground">
              Affected files by depth
            </h3>
            <div className="mt-3 space-y-3">
              {byDepth.map(([d, files]) => (
                <div key={d}>
                  <p className="text-xs font-medium text-muted-foreground">
                    Depth {d} · {files.length}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {files.slice(0, 20).map((f) => (
                      <li key={f} className="flex items-center gap-2 text-xs">
                        <ChevronRight className="size-3 text-muted-foreground" />
                        <span className="truncate">{shorten(f, 50)}</span>
                        <span className="ml-auto">
                          <RoleBadge path={f} />
                        </span>
                      </li>
                    ))}
                    {files.length > 20 && (
                      <li className="text-xs text-muted-foreground">
                        +{files.length - 20} more
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {model.sccs.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">
                  Circular dependencies
                </h3>
              </div>
              <ul className="mt-3 space-y-2">
                {model.sccs.slice(0, 8).map((cycle, index) => {
                  const touches = cycle.some((id) => changeSet.includes(id))
                  return (
                    <li
                      key={index}
                      className={`rounded-lg border p-2 text-xs ${
                        touches
                          ? "border-amber-300 bg-amber-50"
                          : "border-border"
                      }`}
                    >
                      {cycle.map((id) => shorten(id, 30)).join(" → ")}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">Safe to change</h3>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {safe.length === 0 && (
                  <li className="text-muted-foreground">None found.</li>
                )}
                {safe.map((n) => (
                  <li key={n.id} className="truncate text-muted-foreground">
                    {shorten(n.id, 46)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-rose-600" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">Riskiest files</h3>
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {risky.map((r) => (
                  <li key={r.id} className="flex items-center gap-2">
                    <span className="truncate text-muted-foreground">
                      {shorten(r.id, 40)}
                    </span>
                    <span className="ml-auto tabular-nums">{r.risk.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {unused.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-muted-foreground" aria-hidden />
                <h3 className="text-sm font-semibold text-foreground">
                  Possibly unused
                </h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                No importers found. These are candidates only, not confirmed dead code.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {unused.map((n) => (
                  <li key={n.id} className="truncate text-muted-foreground">
                    {shorten(n.id, 46)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changeSet[0] && (
            <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
              <h3 className="text-sm font-semibold text-foreground">
                Dependent depth rings
              </h3>
              <DepthRings
                selected={changeSet[0]}
                affected={impact.affected}
                maxDepth={depth}
              />
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DepthRings({
  selected,
  affected,
  maxDepth,
}: {
  selected: string
  affected: { id: string; depth: number }[]
  maxDepth: number
}) {
  const size = 220
  const center = size / 2
  const rings = Array.from({ length: maxDepth }, (_, i) => i + 1)
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mt-3 h-[220px] w-full"
      role="img"
      aria-label="Dependent depth rings"
    >
      {rings.map((d) => {
        const radius = (center - 12) * (d / maxDepth)
        const count = affected.filter((a) => a.depth === d).length
        return (
          <g key={d}>
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke="currentColor"
              className="text-border"
              strokeWidth={1}
              opacity={0.6}
            />
            {count > 0 && (
              <text
                x={center + radius - 2}
                y={center - 2}
                fontSize="8"
                className="fill-muted-foreground"
              >
                {count}
              </text>
            )}
          </g>
        )
      })}
      <circle cx={center} cy={center} r={5} className="fill-primary" />
      <text x={center} y={center + 16} fontSize="7" textAnchor="middle" className="fill-muted-foreground">
        {topFolder(selected)}
      </text>
    </svg>
  )
}
