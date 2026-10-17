import { KeyRound } from "lucide-react"

import { CreateKeyDialog } from "./create-key-dialog"
import { CopyButton } from "@/components/dashboard/copy-button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ApiKey = {
  id: string
  name: string
  masked: string
  createdAt: string
  lastUsed: string
}

const keys: ApiKey[] = []

const loginCommand = "hulucode auth login --key <YOUR_KEY>"

export default function ApiKeysPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="API keys"
        description="Secret keys that let the CLI access your account."
        action={<CreateKeyDialog />}
      />

      {keys.length === 0 ? (
        <EmptyState
          icon={KeyRound}
          title="No API keys"
          description="Create a key to start using the CLI."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="px-4">Name</TableHead>
                <TableHead className="px-4">Key</TableHead>
                <TableHead className="px-4">Created</TableHead>
                <TableHead className="px-4">Last used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="px-4 font-medium">{key.name}</TableCell>
                  <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                    {key.masked}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {key.createdAt}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {key.lastUsed}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Use your key</CardTitle>
          <CardDescription>
            Authenticate the CLI with a key once you have created one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2">
            <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-foreground">
              {loginCommand}
            </code>
            <CopyButton value={loginCommand} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
