"use client"

import { useEffect, useState } from "react"
import {
  ChevronDown,
  Code,
  Copy,
  Database,
  FileText,
  Loader2,
  MessageSquare,
  Search,
  Trash2,
  X,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PageHelper } from "@/components/dashboard/page-helper"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatCount, getPlanLabel, getPlanLimits } from "@/lib/plans"
import { fileRole, roleColorClass } from "@/lib/graph"

type QueryRecord = {
  id: string
  question: string
  answer: { answer: string; files: string[]; confidence: "low" | "medium" | "high"; followups: string[] }
  files: { path: string; symbols: string[] }[]
  createdAt: string
}

const SUGGESTIONS = [
  "Where is authentication handled?",
  "Which files touch the database?",
  "What breaks if I change auth.ts?",
  "Where should I start reading?",
  "How does the payment flow work?",
  "What are the main API routes?",
  "Which files import config.ts?",
  "Show me the entry points",
]

export default function QueriesPage() {
  const [queries, setQueries] = useState<QueryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [planLimit, setPlanLimit] = useState<{ allowed: boolean; used: number; limit: number; planTier?: string } | null>(null)

  const fetchProjects = async () => {
    try {
      const res = await fetch("/api/v1/projects")
      if (res.ok) {
        const data = await res.json()
        setProjects(data.projects ?? [])
        if (data.projects?.[0] && !selectedProjectId) {
          setSelectedProjectId(data.projects[0].id)
        }
      }
    } catch {}
  }

  const fetchPlanLimit = async () => {
    if (!selectedProjectId) return
    try {
      const res = await fetch(`/api/ai/plan-limit?projectId=${selectedProjectId}`)
      if (res.ok) {
        const data = await res.json()
        setPlanLimit(data)
      }
    } catch {}
  }

  const fetchQueries = async () => {
    if (!selectedProjectId) return
    try {
      setLoading(true)
      const res = await fetch(`/api/ai/queries?projectId=${selectedProjectId}`)
      if (res.ok) {
        const data = await res.json()
        setQueries(data.queries ?? [])
      }
    } catch {
      setError("Failed to load queries")
    } finally {
      setLoading(false)
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchProjects()
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchQueries().finally(() => setLoading(false))
    fetchPlanLimit()
  }, [selectedProjectId])
/* eslint-enable react-hooks/exhaustive-deps, react-hooks/set-state-in-effect */

  const submitQuestion = async () => {
    if (!selectedProjectId || !question.trim() || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: selectedProjectId, question: question.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to ask")
      setQueries((prev) => [data, ...prev])
      setQuestion("")
      fetchPlanLimit()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to ask")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSuggestion = (s: string) => {
    setQuestion(s)
  }

  const deleteQuery = async (id: string) => {
    try {
      await fetch(`/api/ai/queries?projectId=${selectedProjectId}&id=${id}`, { method: "DELETE" })
      setQueries((prev) => prev.filter((q) => q.id !== id))
      fetchPlanLimit()
    } catch {}
  }

  const clearAll = async () => {
    try {
      await fetch(`/api/ai/queries?projectId=${selectedProjectId}`, { method: "DELETE" })
      setQueries([])
      setShowClearConfirm(false)
      fetchPlanLimit()
    } catch {}
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {}
  }

  const planLimits = getPlanLimits(planLimit?.planTier ?? "free")
  const questionsUsed = planLimit?.used ?? 0
  const questionsLimit = planLimit?.limit ?? planLimits.questionsPerMonth
  const canAsk = planLimit?.allowed ?? true

  return (
    <div className="space-y-8">
      <PageHeader
        title="Ask your codebase"
        description="Questions you asked about your codebases."
      />
      <PageHelper
        text="Select a project, then ask a question about its codebase. The AI will search the structure and give you an answer with cited files."
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-4">
          <Card className="shadow-xs">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-balance">Ask a question</CardTitle>
                <CardDescription>
                  Select a project, then type your question or pick a suggestion below.
                </CardDescription>
              </div>
              <Select
                value={selectedProjectId ?? ""}
                onValueChange={setSelectedProjectId}
                disabled={projects.length === 0}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                  {projects.length === 0 && (
                    <SelectItem disabled value="">
                      No projects
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {selectedProjectId ? (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {getPlanLabel(planLimit?.planTier ?? "free")} plan
                    </span>
                    <span className="font-medium tabular-nums">
                      {questionsUsed} / {questionsLimit} questions this month
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      placeholder="e.g., Where is authentication handled?"
                      className="flex-1"
                      disabled={submitting || !canAsk}
                    />
                    <Button onClick={submitQuestion} disabled={submitting || !canAsk || !question.trim()}>
                      {submitting ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Search className="size-4" />
                      )}
                      Ask
                    </Button>
                  </div>
                  {!canAsk && (
                    <p className="text-sm text-rose-600">
                      Monthly limit reached. Upgrade to Pro for more questions.
                    </p>
                  )}
                  {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-700 text-sm">
                      {error}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <Button
                        key={s}
                        variant="outline"
                        size="sm"
                        onClick={() => handleSuggestion(s)}
                        className="text-xs"
                        disabled={submitting || !canAsk}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="size-12 mx-auto mb-3" />
                  <p>Select a project to start asking questions.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {queries.length > 0 ? (
            <div className="space-y-4">
              {queries.map((q) => (
                <Card key={q.id} className="shadow-xs">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground">{q.question}</p>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => deleteQuery(q.id)}
                        className="text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="prose prose-sm max-w-none text-sm">
                      {q.answer.answer.split("\n").map((line) => (
                        <p key={line} className="my-1">{line}</p>
                      ))}
                    </div>
                    {q.answer.files.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {q.answer.files.map((f) => (
                          <Button
                            key={f}
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const params = new URLSearchParams()
                              params.set("tab", "graph")
                              params.set("selected", f)
                              window.history.pushState({}, "", `/dashboard/projects/${selectedProjectId}?${params.toString()}`)
                            }}
                          >
                            <FileText className="size-3.5" />
                            {f}
                          </Button>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        variant={
                          q.answer.confidence === "high"
                            ? "default"
                            : q.answer.confidence === "medium"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        Confidence: {q.answer.confidence}
                      </Badge>
                      {q.answer.followups.length > 0 && (
                        <>
                          <Separator className="h-4 w-px" />
                          <span>Follow-ups:</span>
                          {q.answer.followups.map((f) => (
                            <Button
                              key={f}
                              variant="outline"
                              size="sm"
                              onClick={() => handleSuggestion(f)}
                              className="text-xs"
                            >
                              {f}
                            </Button>
                          ))}
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="shadow-xs">
              <CardContent className="py-8 text-center">
                <EmptyState
                  icon={MessageSquare}
                  title="No questions yet"
                  description="Select a project and ask your first question above to get started."
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-balance">History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {queries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No questions yet</p>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {queries.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 rounded-lg border border-border bg-muted/50"
                    >
                      <p className="text-sm font-medium text-foreground truncate">{q.question}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {new Date(q.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {queries.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowClearConfirm(true)}
                >
                  <Trash2 className="size-3.5" />
                  Clear all
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-xs">
            <CardHeader>
              <CardTitle className="text-balance">Suggestions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-0">
              {SUGGESTIONS.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handleSuggestion(s)}
                  disabled={submitting || !selectedProjectId || !canAsk}
                >
                  {s}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {showClearConfirm && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm">
          <p>Delete all queries for this project? This cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="destructive" onClick={clearAll}>
              Delete all
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowClearConfirm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}