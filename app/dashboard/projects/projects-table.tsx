"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { FolderGit2, MoreHorizontal, Search, Trash2 } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatCount } from "@/lib/plans"

export type ProjectRow = {
  id: string
  name: string
  fileCount: number
  chunkCount: number
  languages: { name: string; count: number }[]
  lastSynced: string
}

export function ProjectsTable({ projects }: { projects: ProjectRow[] }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [target, setTarget] = useState<ProjectRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase()
    if (text === "") {
      return projects
    }
    return projects.filter((project) => project.name.toLowerCase().includes(text))
  }, [projects, query])

  async function remove(project: ProjectRow) {
    setError(null)

    try {
      const response = await fetch(`/api/v1/projects/${project.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as
          | { error?: string }
          | null
        setError(data?.error ?? "Could not delete this project.")
        return
      }

      setTarget(null)
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server. Please try again.")
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative w-full sm:w-64">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search projects"
          className="pl-8"
          aria-label="Search projects"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {filtered.length === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="No projects match your search"
          description="Try a different name."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Project</TableHead>
                <TableHead className="px-4">Files</TableHead>
                <TableHead className="px-4">Chunks</TableHead>
                <TableHead className="px-4">Languages</TableHead>
                <TableHead className="px-4">Last synced</TableHead>
                <TableHead className="w-12 px-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((project) => (
                <TableRow key={project.id}>
                  <TableCell className="px-4 font-medium">
                    <Link
                      href={`/dashboard/projects/${project.id}`}
                      className="rounded-sm hover:underline"
                    >
                      {project.name}
                    </Link>
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {formatCount(project.fileCount)}
                  </TableCell>
                  <TableCell className="px-4 tabular-nums text-muted-foreground">
                    {formatCount(project.chunkCount)}
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex flex-wrap gap-1">
                      {project.languages.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        project.languages.slice(0, 3).map((language) => (
                          <Badge key={language.name} variant="secondary">
                            {language.name}
                          </Badge>
                        ))
                      )}
                      {project.languages.length > 3 && (
                        <Badge variant="outline">
                          +{project.languages.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {project.lastSynced}
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg"
                          aria-label={`Actions for ${project.name}`}
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/projects/${project.id}`}>
                            Open
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setTarget(project)}
                        >
                          <Trash2 aria-hidden />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {target?.name} and everything indexed for it. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={pending}
              onClick={(event) => {
                event.preventDefault()
                if (target) {
                  void remove(target)
                }
              }}
            >
              {pending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
