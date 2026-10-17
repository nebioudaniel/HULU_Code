import { redirect } from "next/navigation"
import { connection } from "next/server"
import { CreditCard } from "lucide-react"

import { auth } from "@/auth"
import { UpgradeToProButton } from "../upgrade-to-pro-button"
import { EmptyState } from "@/components/dashboard/empty-state"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
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
import { pool } from "@/lib/db"
import { getPlanLabel } from "@/lib/plans"

type PaymentRow = Record<string, unknown>

const DATE_KEYS = [
  "created_at",
  "createdAt",
  "inserted_at",
  "paid_at",
  "timestamp",
] as const

function formatDate(raw: unknown): string {
  if (!raw) return "—"
  const date = new Date(String(raw))
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function getDate(row: PaymentRow): unknown {
  for (const key of DATE_KEYS) {
    if (row[key]) return row[key]
  }
  return null
}

async function getPayments(userId: string): Promise<PaymentRow[]> {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM payments WHERE user_id = $1",
      [userId]
    )
    return (rows as PaymentRow[]).sort((a, b) => {
      const aTime = new Date(String(getDate(a) ?? 0)).getTime()
      const bTime = new Date(String(getDate(b) ?? 0)).getTime()
      return bTime - aTime
    })
  } catch {
    return []
  }
}

export default async function BillingPage() {
  await connection()

  const session = await auth()
  if (!session?.user?.id) redirect("/")

  const isPro = session.user.plan_tier === "pro"
  const planLabel = getPlanLabel(session.user.plan_tier)
  const payments = await getPayments(session.user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description="Your plan and payment history."
      />

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-foreground">
              {planLabel} plan
            </span>
            <Badge variant={isPro ? "default" : "secondary"}>
              {planLabel}
            </Badge>
          </div>

          {isPro ? (
            <p className="text-sm text-muted-foreground">
              {session.user.plan_ends_at
                ? `Active until ${new Date(
                    session.user.plan_ends_at
                  ).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}.`
                : "Your Pro subscription is active."}
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Upgrade to unlock more projects, storage, and questions.
              </p>
              <UpgradeToProButton />
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-medium tracking-tight text-foreground">
          Payment history
        </h2>

        {payments.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            title="No payments yet"
            description="Your payment receipts will appear here."
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Date</TableHead>
                  <TableHead className="px-4">Amount</TableHead>
                  <TableHead className="px-4">Currency</TableHead>
                  <TableHead className="px-4">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, index) => {
                  const status = String(payment.status ?? "pending")
                  return (
                    <TableRow
                      key={String(payment.tx_ref ?? payment.id ?? index)}
                    >
                      <TableCell className="px-4 text-foreground">
                        {formatDate(getDate(payment))}
                      </TableCell>
                      <TableCell className="px-4 tabular-nums text-foreground">
                        {payment.amount != null ? String(payment.amount) : "—"}
                      </TableCell>
                      <TableCell className="px-4 text-muted-foreground">
                        {payment.currency != null
                          ? String(payment.currency)
                          : "—"}
                      </TableCell>
                      <TableCell className="px-4">
                        <Badge
                          variant={
                            status.toLowerCase() === "success"
                              ? "default"
                              : status.toLowerCase() === "failed" ||
                                  status.toLowerCase() === "cancelled"
                                ? "destructive"
                                : "secondary"
                          }
                          className="capitalize"
                        >
                          {status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  )
}
