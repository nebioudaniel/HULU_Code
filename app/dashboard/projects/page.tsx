import { FolderGit2, Search } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type Project = {
  id: string
  name: string
  chunks: number
  lastScan: string
}

const projects: Project[] = []

export default function ProjectsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Projects"
        description="Codebases you have indexed with the CLI."
        action={
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search projects"
              disabled
              title="Coming next"
              className="pl-8"
              aria-label="Search projects"
            />
          </div>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects yet"
          description="Run hulucode scan --local in your project folder to see it here."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Project</TableHead>
                <TableHead className="px-4">Code chunks</TableHead>
                <TableHead className="px-4">Last scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="px-4 font-medium">
                    {project.name}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {project.chunks}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {project.lastScan}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
