"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  FileCode,
  GitCompareArrows,
  LayoutDashboard,
  Network,
} from "lucide-react"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { FilesSymbols } from "./files-symbols"
import { StatCard } from "@/components/dashboard/stat-card"
import type { ProjectSummary, ProjectFileRow } from "@/lib/projects"

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "files", label: "Files & symbols", icon: FileCode },
  { id: "graph", label: "Dependency map", icon: Network },
  { id: "impact", label: "Impact analysis", icon: GitCompareArrows },
] as const

type ProjectTabId = (typeof TABS)[number]["id"]

const LazyGraph = dynamic(
  () => import("./dependency-map").then((mod) => mod.DependencyMap),
  {
    loading: () => (
      <div className="h-[520px] flex items-center justify-center rounded-lg border border-background/50 bg-background">
        <Skeleton className="w-48 h-8" />
      </div>
    ),
    ssr: false,
  }
)

const LazyImpact = dynamic(
  () => import("./impact-analysis").then((mod) => mod.ImpactAnalysis),
  {
    loading: () => (
      <div className="h-[520px] flex items-center justify-center rounded-lg border border-background/50 bg-background">
        <Skeleton className="w-48 h-8" />
      </div>
    ),
    ssr: false,
  }
)

type ProjectWorkspaceProps = {
  project: ProjectSummary
  files: ProjectFileRow[]
}

export function ProjectWorkspace({
  project,
  files,
}: ProjectWorkspaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlTabRaw = searchParams.get("tab")
  const urlTab: ProjectTabId | null = TABS.some((item) => item.id === urlTabRaw)
    ? (urlTabRaw as ProjectTabId)
    : null

  const [tab, setTab] = useState<ProjectTabId>(urlTab ?? "overview")

  // Sync URL tab <- state tab (replaceState, no navigation).
  useEffect(() => {
    if (tab === urlTab) return
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", tab)
    const url = `${pathname}?${params.toString()}`
    window.history.replaceState({}, "", url)
    router.replace(url, { scroll: false })
  }, [tab, pathname, searchParams, router, urlTab])

  // Handle browser Back/Forward (popstate).
  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search)
      const t = params.get("tab")
      const next: ProjectTabId = TABS.some((item) => item.id === t)
        ? (t as ProjectTabId)
        : "overview"
      setTab(next)
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <Tabs value={tab} onValueChange={(value) => setTab(value as ProjectTabId)}>
          <div className="overflow-x-auto border-b border-border">
            <TabsList variant="line" className="w-full">
              {TABS.map((item) => {
                const Icon = item.icon
                return (
                  <TabsTrigger key={item.id} value={item.id} className="flex-none">
                    <Icon aria-hidden />
                    {item.label}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </div>
        </Tabs>
      </div>

      <Separator />

      {tab === "graph" && (
        <div className="w-full h-[520px]">
          <LazyGraph projectId={project.id} />
        </div>
      )}

      {tab === "impact" && (
        <div className="w-full h-[520px]">
          <LazyImpact projectId={project.id} />
        </div>
      )}

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Files" value={project.fileCount} icon={FileCode} />
            <StatCard
              label="Chunks"
              value={project.chunkCount}
              icon={FileCode}
            />
            <StatCard label="Edges" value={project.edgeCount} icon={Network} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="text-base font-medium tracking-tight text-foreground">
                Overview
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Pro plan · 49.9 ETB / month
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
              <h2 className="text-base font-medium tracking-tight text-foreground">
                Top external dependencies
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                External dependencies are shown on the dependency map.
              </p>
            </div>
          </div>
        </div>
      )}

      {tab === "files" && <FilesSymbols files={files} />}
    </div>
  )
}
