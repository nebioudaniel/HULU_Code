"use client"

import { Fragment, useMemo, useState } from "react"
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
import { SymbolKindBadge } from "@/components/dashboard/symbol-kind-badge"
import { HttpMethodBadge, isHttpHandlerMethod } from "@/components/dashboard/http-method-badge"
import { fileRole, roleColorClass, roleInfo } from "@/lib/graph"

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
  chunkCount: number
  symbols?: SymbolRow[]
}

const SYMBOL_KINDS = ["component", "function", "method", "type", "interface", "struct", "export"]

export function SymbolLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span className="font-semibold">Symbol kinds:</span>
      {SYMBOL_KINDS.map((kind) => (
        <SymbolKindBadge key={kind} kind={kind} />
      ))}
    </div>
  )
}

function symbolBadges({ filePath, symbol }: { filePath: string; symbol: SymbolRow }) {
  const isRoute = /(^|\/)(route)\.(ts|tsx|js|jsx)$/.test(filePath)
  const showMethod =
    symbol.kind.toLowerCase() === "function" &&
    isHttpHandlerMethod(symbol.name) &&
    isRoute
  if (showMethod) {
    return <HttpMethodBadge method={symbol.name} />
  }
  return <SymbolKindBadge kind={symbol.kind} />
}

function roleBadge(file: FileRow) {
  const role = fileRole(file.path)
  const info = roleInfo(role, roleColorClass(role))
  return (
    <Badge
      variant="outline"
      style={{ color: info.color, borderColor: info.color }}
    >
      {info.label}
    </Badge>
  )
}

export function FilesSymbols({
  files,
}: {
  files: FileRow[]
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [kindFilter, setKindFilter] = useState("all")
  const [httpOnly, setHttpOnly] = useState(false)
  const [sort, setSort] = useState("name")
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const toggle = (path: string) => {
    setOpen((current) => ({ ...current, [path]: !current[path] }))
  }

  const filtered = useMemo(() => {
    let list = files.filter((file) => {
      const term = search.toLowerCase()
      if (term && !file.path.toLowerCase().includes(term)) return false
      if (filter !== "all" && file.language.toLowerCase() !== filter.toLowerCase()) return false
      if (httpOnly) {
        const hasHttp = file.symbols?.some(
          (s) =>
            s.kind.toLowerCase() === "function" &&
            isHttpHandlerMethod(s.name) &&
            /(^|\/)(route)\.(ts|tsx|js|jsx)$/.test(file.path)
        )
        if (!hasHttp) return false
      }
      if (kindFilter !== "all") {
        const hasKind = file.symbols?.some(
          (s) => s.kind.toLowerCase() === kindFilter.toLowerCase()
        )
        if (!hasKind) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.path.localeCompare(b.path)
      if (sort === "lines") return b.lineCount - a.lineCount
      if (sort === "connections") return b.chunkCount - a.chunkCount
      return 0
    })
    return list
  }, [files, search, filter, kindFilter, httpOnly, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = (safePage - 1) * pageSize
  const pageFiles = filtered.slice(start, start + pageSize)

  const languages = useMemo(() => {
    const set = new Set<string>()
    for (const f of files) set.add(f.language)
    return Array.from(set).sort()
  }, [files])

  const kinds = useMemo(() => {
    const set = new Set<string>()
    for (const f of files) {
      for (const s of f.symbols ?? []) set.add(s.kind)
    }
    return Array.from(set).sort()
  }, [files])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SymbolLegend />
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-2">
          <div className="flex items-center gap-1.5">
            <input
              placeholder="Filter files…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[200px] text-xs border border-input rounded-lg px-3 bg-background"
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="h-8 w-[150px] text-xs border border-input rounded-lg px-3 bg-background"
            >
              <option value="all">All languages</option>
              {languages.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="h-8 w-[150px] text-xs border border-input rounded-lg px-3 bg-background"
            >
              <option value="all">All kinds</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant={httpOnly ? "default" : "outline"}
              size="sm"
              onClick={() => setHttpOnly((v) => !v)}
              className="rounded-lg"
              aria-pressed={httpOnly}
            >
              HTTP handlers only
            </Button>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="h-8 w-[130px] text-xs border border-input rounded-lg px-3 bg-background"
            >
              <option value="name">Name</option>
              <option value="lines">Lines</option>
              <option value="connections">Chunks</option>
            </select>
            <select
              value={String(pageSize)}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 w-[130px] text-xs border border-input rounded-lg px-3 bg-background"
            >
              {[25, 50, 100].map((s) => (
                <option key={String(s)} value={String(s)}>
                  {s} per page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">File</TableHead>
              <TableHead className="px-4">Role</TableHead>
              <TableHead className="px-4">Language</TableHead>
              <TableHead className="px-4">Symbols</TableHead>
              <TableHead className="px-4 tabular-nums">Lines</TableHead>
              <TableHead className="px-4 tabular-nums">Chunks</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageFiles.map((file) => {
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
                    <TableCell className="px-4">{roleBadge(file)}</TableCell>
                    <TableCell className="px-4">
                      <Badge variant="secondary">{file.language}</Badge>
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {file.symbols?.length ?? 0}
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {file.lineCount}
                    </TableCell>
                    <TableCell className="px-4 tabular-nums text-muted-foreground">
                      {file.chunkCount}
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow key={`${file.path}-symbols`}>
                      <TableCell colSpan={6} className="bg-muted/40 px-4 py-3">
                        {file.symbols?.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            No symbols were found in this file.
                          </p>
                        ) : (
                          <ul className="space-y-1">
                            {(file.symbols ?? []).map((symbol) => (
                              <li
                                key={`${symbol.kind}-${symbol.parent}-${symbol.name}-${symbol.startLine}`}
                                className="flex items-center gap-2 text-sm"
                              >
                                {symbolBadges({ filePath: file.path, symbol })}
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
          Showing{" "}
          <span className="font-medium text-foreground">
            {filtered.length === 0 ? 0 : start + 1}
          </span>{" "}
          to{" "}
          <span className="font-medium text-foreground">
            {Math.min(start + pageSize, filtered.length)}
          </span>{" "}
          of{" "}
          <span className="font-medium text-foreground">{filtered.length}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={safePage <= 1}
          >
            Previous
          </Button>
          <Button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={safePage >= totalPages}
          >
            Next
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
        </div>
      </div>
    </div>
  )
}
