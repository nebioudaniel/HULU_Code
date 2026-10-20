import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import {
  ArrowLeft,
  FileCode,
  GitCompareArrows,
  Network,
} from "lucide-react"

import { auth } from "@/auth"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PageHelper } from "@/components/dashboard/page-helper"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { formatCount, getPlanLabel } from "@/lib/plans"
import {
  countProjectFiles,
  getProject,
  isProjectId,
  listProjectChunks,
  listProjectFiles,
  type ProjectSummary,
} from "@/lib/projects"
import { FilesSymbols, type FileRow } from "./files-symbols"
import { ProjectTabs, type ProjectTabId } from "./project-tabs"
import { DependencyMap } from "@/components/dashboard/dependency-map"
import { ImpactAnalysis } from "@/components/dashboard/impact-analysis"

const PAGE_SIZE = 100
const TABS = ["overview", "files", "graph", "impact"] as const

function resolveTab(value: string | string[] | undefined): ProjectTabId {
  const tab = Array.isArray(value) ? value[0] : value
  return TABS.some((item) => item === tab) ? (tab as ProjectTabId) : "overview"
}

function resolvePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value
  const page = Number.parseInt(raw ?? "1", 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

function formatRelative(value: string | null): string {
  if (!value) {
    return "Never"
  }

  const then = new Date(value).getTime()
  if (Number.isNaN(then)) {
    return "Never"
  }

  const minutes = Math.round((Date.now() - then) / 60000)
  if (minutes < 1) {
    return "just now"
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  }

  const hours = Math.round(minutes / 60)
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`
  }

  const days = Math.round(hours / 24)
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function OverviewTab({ project }: { project: ProjectSummary }) {
  const languages = Object.entries(project.languages).sort(
    (a, b) => b[1] - a[1]
  )
  const totalFiles = languages.reduce((sum, [, count]) => sum + count, 0)
  const external = [...project.externalDependencies]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Files" value={project.fileCount} icon={FileCode} />
        <StatCard label="Chunks" value={project.chunkCount} icon={FileCode} />
        <StatCard label="Edges" value={project.edgeCount} icon={Network} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-medium tracking-tight text-foreground">
            Languages
          </h2>
          {languages.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No languages were detected.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {languages.map(([name, count]) => {
                const pct =
                  totalFiles > 0 ? Math.round((count / totalFiles) * 100) : 0
                return (
                  <li key={name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatCount(count)} file{count === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                )}
              )}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-xs">
          <h2 className="text-base font-medium tracking-tight text-foreground">
            Top external dependencies
          </h2>
          {external.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No external dependencies were found.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {external.map((dependency) => (
                <li
                  key={dependency.name}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <span className="truncate font-medium text-foreground">
                    {dependency.name}
                  </span>
                  <Badge variant="secondary">{dependency.count}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const { id } = await params
  if (!isProjectId(id)) notFound()

  const project = await getProject(session.user.id, id)
  if (!project) notFound()

  const query = await searchParams
  const active = resolveTab(query.tab)
  const page = resolvePage(query.page)
  const basePath = `/dashboard/projects/${id}`

  let filesView: React.ReactNode = null
  if (active === "files") {
    const totalFiles = await countProjectFiles(id)
    const totalPages = Math.max(1, Math.ceil(totalFiles / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const fileRows = await listProjectFiles(
      id,
      PAGE_SIZE,
      (safePage - 1) * PAGE_SIZE
    )
    const chunks = await listProjectChunks(
      id,
      fileRows.map((file) => file.path)
    )
    const files = fileRows.map<FileRow>((file) => ({
      path: file.path,
      language: file.language,
      lineCount: file.lineCount,
      partial: file.partial,
      symbols: chunks
        .filter((chunk) => chunk.filePath === file.path)
        .map((chunk) => ({
          kind: chunk.kind,
          name: chunk.name,
          parent: chunk.parent,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
        })),
    }))

    filesView =
      files.length === 0 ? (
        <EmptyState
          icon={FileCode}
          title="No files indexed"
          description="Files and symbols will appear here after the first scan."
        />
      ) : (
        <FilesSymbols
          files={files}
          page={safePage}
          totalPages={totalPages}
          basePath={basePath}
        />
      )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Projects
        </Link>
      </div>

      <PageHeader
        title={project.name}
        description={`${formatCount(project.fileCount)} files · ${formatCount(
          project.chunkCount
        )} chunks · ${formatCount(project.edgeCount)} edges · synced ${formatRelative(
          project.lastSyncedAt
        )}`}
      />
      <PageHelper
        text="Explore your synced project: view files and symbols, the dependency map, and impact analysis for any file."
      />

      <ProjectTabs basePath={basePath} active={active} />

      {active === "overview" && <OverviewTab project={project} />}

      {active === "files" && filesView}

      {active === "graph" && (
        <>
          {project.edgeCount === 0 ? (
            <EmptyState
              icon={Network}
              title="Dependency map"
              description="No dependencies were found. Run another sync to index import relationships."
            />
          ) : (
            <DependencyMap projectId={id} />
          )}
        </>
      )}

      {active === "impact" && (
        <>
          {project.edgeCount === 0 ? (
            <EmptyState
              icon={GitCompareArrows}
              title="Impact analysis"
              description="No dependencies were found. Run another sync to index import relationships."
            />
          ) : (
            <ImpactAnalysis projectId={id} />
          )}
        </>
      )}
    </div>
  )
}
