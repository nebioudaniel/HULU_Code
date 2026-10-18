"use client"

import { Fragment, useState } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type SymbolRow = {
  kind: string
  name: string
  parent: string
  startLine: number
  endLine: number
}

export type FileRow = {
  path: string
  language: string
  lineCount: number
  partial: boolean
  symbols: SymbolRow[]
}

export function FilesSymbols({
  files,
  basePath,
  page,
  totalPages,
}: {
  files: FileRow[]
  page: number
  totalPages: number
  basePath: string
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})

  function toggle(path: string) {
    setOpen((current) => ({ ...current, [path]: !current[path] }))
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">File</TableHead>
              <TableHead className="px-4">Language</TableHead>
              <TableHead className="px-4">Symbols</TableHead>
              <TableHead className="px-4">Lines</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => {
              const expanded = Boolean(open[file.path])
              return (
                <Fragment key={file.path}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => toggle(file.path)}
                  >
                    <TableCell className="px-4 font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={expanded ? "Collapse" : "Expand"}
                          aria-expanded={expanded}
                          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-transform"
                          onClick={(event) => {
                            event.stopPropagation()
                            toggle(file.path)
                          }}
                        >
                          <ChevronRight
                            className={expanded ? "rotate-90 transition-transform" : "transition-transform"}
                            aria-hidden
                          />
                        </button>
                        <span className="truncate">{file.path}</span>
                        {file.partial && (
                          <Badge variant="outline" title="Partially parsed">
                            partial
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <Badge variant="secondary">{file.language}</Badge>
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {file.symbols.length}
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {file.lineCount}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow key={`${file.path}-symbols`}>
                      <TableCell colSpan={4} className="bg-muted/40 px-4 py-3">
                        {file.symbols.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No symbols were found in this file.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {file.symbols.map((symbol) => (
                              <li
                                key={`${symbol.kind}-${symbol.parent}-${symbol.name}-${symbol.startLine}`}
                                className="flex items-center gap-2 text-sm"
                              >
                                <Badge variant="outline">{symbol.kind}</Badge>
                                <span className="font-medium text-foreground">
                                  {symbol.parent
                                    ? `${symbol.parent}.${symbol.name}`
                                    : symbol.name}
                                </span>
                                <span className="tabular-nums text-muted-foreground">
                                  {symbol.startLine}-{symbol.endLine}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={page <= 1}
          >
            <Link
              href={`${basePath}?tab=files&page=${Math.max(1, page - 1)}`}
              aria-disabled={page <= 1}
            >
              Previous
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={page >= totalPages}
          >
            <Link
              href={`${basePath}?tab=files&page=${page + 1}`}
              aria-disabled={page >= totalPages}
            >
              Next
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
