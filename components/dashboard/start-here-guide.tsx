"use client"

import { useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Download,
  FileText,
  GitCompareArrows,
  Link2,
  Network,
  RefreshCw,
  Settings,
  Sparkles,
  Trash2,
  X,
  Loader2,
  MessageSquare,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { fileRole, roleColorClass } from "@/lib/graph"

type Guide = {
  what_for: string
  modules: { name: string; purpose: string; fileCount: number; topFiles: string[] }[]
  reading_list: { path: string; reason: string }[]
  flow: string
  careful: { path: string; advice: string }[]
}

type GuideResponse = {
  guide: Guide
  source: string
  model: string | null
  generatedAt: string
  includeReadme: boolean
  isOutOfDate: boolean
  aiError: string | null
  questionsLeft: number
}

export function StartHereGuide({ projectId }: { projectId: string }) {
  const [data, setData] = useState<GuideResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [includeReadme, setIncludeReadme] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const fetchGuide = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/guide`)
      if (!res.ok) throw new Error("Failed to load guide")
      const json = await res.json()
      setData(json)
      setIncludeReadme(json.includeReadme ?? false)
    } catch (e) {
      setError("Failed to load guide")
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/guide`)
        if (!res.ok) throw new Error("Failed to load guide")
        const json = await res.json()
        if (!cancelled) {
          setData(json)
          setIncludeReadme(json.includeReadme ?? false)
        }
      } catch {
        if (!cancelled) setError("Failed to load guide")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const regenerate = async () => {
    if (!data) return
    setRegenerating(true)
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/guide/regenerate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ include_readme: includeReadme }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to regenerate")
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate")
    } finally {
      setRegenerating(false)
    }
  }

  const copyMarkdown = async () => {
    if (!data) return
    const md = generateMarkdown(data)
    try {
      await navigator.clipboard.writeText(md)
    } catch {}
  }

  const downloadMarkdown = () => {
    if (!data) return
    const md = generateMarkdown(data)
    const blob = new Blob([md], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `start-here-${projectId.slice(0, 8)}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  const deleteReadme = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/meta`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Failed to delete README")
      setData((prev) => prev ? { ...prev, includeReadme: false } : null)
      setIncludeReadme(false)
      setShowDeleteConfirm(false)
    } catch (e) {
      setError("Failed to delete README")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 h-full">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
        {error}
        <Button size="sm" className="mt-2" onClick={fetchGuide}>
          Retry
        </Button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-center text-muted-foreground">
        No guide available.
      </div>
    )
  }

  const guide = data.guide
  const isAI = data.source === "deepseek"
  const candidatePaths = guide.reading_list.map((r) => r.path)

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">Start Here Guide</h2>
        </div>
        <div className="flex items-center gap-2">
          {data.aiError && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <AlertTriangle className="size-3" />
              AI fallback: {data.aiError}
            </Badge>
          )}
          {isAI && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Sparkles className="size-3" />
              AI-generated ({data.model})
            </Badge>
          )}
          {!isAI && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <MessageSquare className="size-3" />
              Rule-based
            </Badge>
          )}
          {data.isOutOfDate && (
            <Badge variant="destructive" className="text-xs flex items-center gap-1">
              <RefreshCw className="size-3" />
              Out of date
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">What this project is for</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm leading-relaxed text-foreground">{guide.what_for}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">Main parts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {guide.modules.map((mod) => (
              <div key={mod.name} className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-foreground">{mod.name}</h4>
                  <Badge variant="secondary" className="text-[10px]">
                    {mod.fileCount} files
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{mod.purpose}</p>
                {mod.topFiles.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {mod.topFiles.slice(0, 2).map((f) => (
                      <li key={f} className="truncate">{f}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">Where to start reading</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {guide.reading_list.map((item, idx) => (
              <li key={item.path} className="flex flex-col sm:flex-row sm:items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold bg-primary text-primary-foreground">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-foreground truncate">{item.path}</span>
                    <Badge
                      variant="outline"
                      style={{ color: roleColorClass(fileRole(item.path)), borderColor: roleColorClass(fileRole(item.path)) }}
                    >
                      {fileRole(item.path)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{item.reason}</p>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set("tab", "graph")
                        params.set("selected", item.path)
                        window.history.pushState({}, "", `/dashboard/projects/${projectId}?${params.toString()}`)
                      }}
                    >
                      <GitCompareArrows className="size-3.5" />
                      Dependency map
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const params = new URLSearchParams()
                        params.set("tab", "impact")
                        params.set("changeSet", item.path)
                        window.history.pushState({}, "", `/dashboard/projects/${projectId}?${params.toString()}`)
                      }}
                    >
                      <AlertTriangle className="size-3.5" />
                      View impact
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="text-balance">How it flows</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-foreground">{guide.flow}</p>
        </CardContent>
      </Card>

      <Card className="shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-balance flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-600" aria-hidden />
            Careful here
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {guide.careful.map((item) => (
              <li key={item.path} className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm text-foreground truncate">{item.path}</span>
                    <Badge
                      variant="outline"
                      style={{ color: roleColorClass(fileRole(item.path)), borderColor: roleColorClass(fileRole(item.path)) }}
                    >
                      {fileRole(item.path)}
                    </Badge>
                    <Badge variant="destructive" className="text-xs">
                      High risk
                    </Badge>
                  </div>
                  <p className="text-xs text-amber-800">{item.advice}</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const params = new URLSearchParams()
                      params.set("tab", "impact")
                      params.set("changeSet", item.path)
                      window.history.pushState({}, "", `/dashboard/projects/${projectId}?${params.toString()}`)
                    }}
                  >
                    <AlertTriangle className="size-3.5" />
                    View impact
                  </Button>
                </div>
              </li>
            ))}
            {guide.careful.length === 0 && (
              <p className="text-sm text-muted-foreground">No high-risk hotspots detected.</p>
            )}
          </ul>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeReadme}
              onCheckedChange={(checked) => setIncludeReadme(checked as boolean)}
              disabled={data.questionsLeft !== undefined && data.questionsLeft <= 0}
            />
            <span className="text-sm text-muted-foreground">Include README to improve the summary</span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          {data.questionsLeft !== undefined && (
            <span className="text-xs text-muted-foreground">
              AI questions left this month: {data.questionsLeft}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={copyMarkdown}
          >
            <Copy className="size-3.5" />
            Copy as Markdown
          </Button>
          <Button size="sm" onClick={downloadMarkdown}>
            <Download className="size-3.5" />
            Download .md
          </Button>
          <Button
            size="sm"
            variant={regenerating ? "default" : "secondary"}
            onClick={regenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Regenerating...
              </>
            ) : (
              <>
                <RefreshCw className="size-3.5" />
                Regenerate
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Delete stored README
          </Button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          <p>Delete the stored README? This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="destructive" onClick={deleteReadme}>
              Delete
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function generateMarkdown(response: GuideResponse): string {
  const { guide, source, model, generatedAt, includeReadme } = response
  const lines: string[] = []
  lines.push("# Start Here Guide")
  lines.push("")
  lines.push(`*Generated: ${new Date(generatedAt).toLocaleString()}*`)
  lines.push(`*Source: ${source}${model ? ` (${model})` : ""}*`)
  lines.push(`*README included: ${includeReadme ? "yes" : "no"}*`)
  lines.push("")

  lines.push("## What this project is for")
  lines.push("")
  lines.push(guide.what_for)
  lines.push("")

  lines.push("## Main parts")
  lines.push("")
  for (const mod of guide.modules) {
    lines.push(`### ${mod.name}`)
    lines.push("")
    lines.push(mod.purpose)
    lines.push("")
    if (mod.topFiles.length > 0) {
      lines.push("Key files:")
      for (const f of mod.topFiles) {
        lines.push(`- ${f}`)
      }
      lines.push("")
    }
  }

  lines.push("## Where to start reading")
  lines.push("")
  for (const [idx, item] of guide.reading_list.entries()) {
    lines.push(`${idx + 1}. \`${item.path}\` — ${item.reason}`)
  }
  lines.push("")

  lines.push("## How it flows")
  lines.push("")
  lines.push(guide.flow)
  lines.push("")

  lines.push("## Careful here")
  lines.push("")
  for (const item of guide.careful) {
    lines.push(`- **${item.path}** — ${item.advice}`)
  }
  if (guide.careful.length === 0) {
    lines.push("No high-risk hotspots detected.")
  }
  lines.push("")

  lines.push("---")
  lines.push(`*This guide was generated by ${source}${model ? ` (${model})` : "rules"}. `)
  if (source === "deepseek") {
    lines.push("*AI-generated sections are marked. Numbers are from deterministic analysis.*")
  }
  lines.push("")

  return lines.join("\n")
}