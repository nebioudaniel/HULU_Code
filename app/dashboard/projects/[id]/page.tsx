import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"

import { auth } from "@/auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { PageHelper } from "@/components/dashboard/page-helper"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCount } from "@/lib/plans"
import { isProjectId, loadProjectPage } from "@/lib/projects"
import { ProjectWorkspace } from "@/components/dashboard/project-workspace"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await connection()

  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const { id } = await params
  if (!isProjectId(id)) notFound()

  const data = await loadProjectPage(session.user.id, id)
  if (!data) notFound()

  const project = data.project

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
        )} chunks · ${formatCount(project.edgeCount)} edges`}
      />
      <PageHelper
        text="Explore your synced project: view files and symbols, the dependency map, and impact analysis for any file."
      />

      <Suspense fallback={<Skeleton className="h-10 w-full" />}>
        <ProjectWorkspace project={project} files={data.files} />
      </Suspense>
    </div>
  )
}
