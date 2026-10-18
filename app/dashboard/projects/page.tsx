import { redirect } from "next/navigation"
import { connection } from "next/server"
import { FolderGit2 } from "lucide-react"

import { auth } from "@/auth"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { listProjects } from "@/lib/projects"
import { ProjectsTable, type ProjectRow } from "./projects-table"

function formatRelative(value: string | null): string {
  if (!value) {
    return "Never"
  }

  const then = new Date(value).getTime()
  if (Number.isNaN(then)) {
    return "Never"
  }

  const seconds = Math.round((Date.now() - then) / 1000)
  if (seconds < 60) {
    return "just now"
  }

  const minutes = Math.round(seconds / 60)
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

export default async function ProjectsPage() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const projects = await listProjects(session.user.id)

  const rows: ProjectRow[] = projects.map((project) => ({
    id: project.id,
    name: project.name,
    fileCount: project.fileCount,
    chunkCount: project.chunkCount,
    languages: Object.entries(project.languages)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    lastSynced: formatRelative(project.lastSyncedAt),
  }))

  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Codebases you have indexed with the CLI."
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Run hulucode scan --local --sync in your project folder to see it here."
        />
      ) : (
        <ProjectsTable projects={rows} />
      )}
    </div>
  )
}
