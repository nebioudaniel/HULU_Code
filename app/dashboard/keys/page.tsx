import Link from "next/link"
import { redirect } from "next/navigation"
import { connection } from "next/server"
import { KeyRound } from "lucide-react"

import { auth } from "@/auth"
import { CreateKeyDialog } from "./create-key-dialog"
import { RevokeKeyButton } from "./revoke-key-button"
import { CopyButton } from "@/components/dashboard/copy-button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { PageHelper } from "@/components/dashboard/page-helper"
import { Badge } from "@/components/ui/badge"
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
import { listApiKeys } from "@/lib/api-keys"
import { getPlanLimits } from "@/lib/plans"


function formatDate(value: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function ApiKeysPage() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const limits = getPlanLimits(session.user.plan_tier)
  const keys = await listApiKeys(session.user.id)

  const activeCount = keys.filter((key) => key.status === "Active").length
  const atLimit = activeCount >= limits.apiKeys
  const siteUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
  const loginCommand = `hulucode auth login --api-url ${siteUrl}`

  return (
    <div className="space-y-8">
      <PageHeader
        title="API keys"
        description="Secret keys that let the CLI access your account."
        action={
          atLimit ? (
            <div className="flex flex-col items-end gap-2 text-right">
              <CreateKeyDialog disabled />
              <p className="max-w-56 text-xs text-muted-foreground">
                You have reached your plan limit of {limits.apiKeys} active{" "}
                {limits.apiKeys === 1 ? "key" : "keys"}.{" "}
                <Link
                  href="/dashboard/billing"
                  className="font-medium text-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Upgrade
                </Link>
              </p>
            </div>
          ) : (
            <CreateKeyDialog />
          )
        }
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
                <TableHead className="px-4">Status</TableHead>
                <TableHead className="w-12 px-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="px-4 font-medium text-foreground">
                    {key.name}
                  </TableCell>
                  <TableCell className="px-4 font-mono text-xs text-muted-foreground">
                    {key.keyPrefix}
                    {"...."}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {formatDate(key.createdAt)}
                  </TableCell>
                  <TableCell className="px-4 text-muted-foreground">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell className="px-4">
                    <Badge
                      variant={key.status === "Active" ? "default" : "secondary"}
                    >
                      {key.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    {key.status === "Active" && (
                      <RevokeKeyButton keyId={key.id} name={key.name} />
                    )}
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
