import Link from "next/link"
import { connection } from "next/server"
import {
  ChevronLeft,
  FileCode,
  GitCompareArrows,
  LayoutDashboard,
  Network,
  type LucideIcon,
} from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { ProjectTabs, type ProjectTabId } from "./project-tabs"

const TABS = ["overview", "files", "graph", "impact"] as const

const TAB_CONTENT: Record<
  ProjectTabId,
  { title: string; description: string; icon: LucideIcon }
> = {
  overview: {
    title: "No summary yet",
    description:
      "Once this project is scanned, you will see an overview of its structure here.",
    icon: LayoutDashboard,
  },
  files: {
    title: "No files indexed",
    description: "Files and symbols will appear here after the first scan.",
    icon: FileCode,
  },
  graph: {
    title: "No dependency map yet",
    description:
      "The dependency graph is built during a scan and will show up here.",
    icon: Network,
  },
  impact: {
    title: "No impact analysis yet",
    description:
      "Ask a question about this project to see what a change might affect.",
    icon: GitCompareArrows,
  },
}

function resolveTab(value: string | string[] | undefined): ProjectTabId {
  const tab = Array.isArray(value) ? value[0] : value
  return TABS.some((item) => item === tab) ? (tab as ProjectTabId) : "overview"
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()

  const { id } = await params
  const active = resolveTab((await searchParams).tab)
  const projectName = decodeURIComponent(id)
  const content = TAB_CONTENT[active]
  const basePath = `/dashboard/projects/${encodeURIComponent(id)}`

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/projects"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
          Projects
        </Link>
      </div>

      <PageHeader title={projectName} />

      <ProjectTabs basePath={basePath} active={active} />

      <EmptyState
        icon={content.icon}
        title={content.title}
        description={content.description}
      />
    </div>
  )
}
