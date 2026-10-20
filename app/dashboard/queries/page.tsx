import { MessagesSquare } from "lucide-react"

import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type QueryRecord = {
  id: string
  question: string
  project: string
  createdAt: string
}

const queries: QueryRecord[] = []

export default function QueriesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Query log"
        description="Questions you have asked about your codebases."
      />

      {queries.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="AI questions are not available yet"
          description="This page will list the questions you have asked about your codebases once AI question support is enabled."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Question</TableHead>
                <TableHead className="px-4">Project</TableHead>
                <TableHead className="px-4">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queries.map((query) => (
                <TableRow key={query.id}>
                  <TableCell className="px-4 font-medium">
                    {query.question}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {query.project}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {query.createdAt}
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
