import { connection } from "next/server"

import { auth } from "@/auth"
import { PageHeader } from "@/components/dashboard/page-header"
import { countActiveApiKeys } from "@/lib/api-keys"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { formatCount, getPlanLabel, getPlanLimits } from "@/lib/plans"

type Meter = {
  label: string
  used: number
  limit: number
}

function MeterRow({ label, used, limit }: Meter) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {formatCount(used)} / {formatCount(limit)}
        </span>
      </div>
      <Progress value={pct} aria-label={`${label} usage`} />
    </div>
  )
}

export default async function UsagePage() {
  await connection()

  const session = await auth()
  const limits = getPlanLimits(session?.user?.plan_tier)

  const userId = session?.user?.id
  const apiKeyCount = userId ? await countActiveApiKeys(userId) : 0

  const meters: Meter[] = [
    { label: "Projects", used: 0, limit: limits.projects },
    { label: "Code chunks", used: 0, limit: limits.chunks },
    {
      label: "AI questions this month",
      used: 0,
      limit: limits.questionsPerMonth,
    },
    { label: "API keys", used: apiKeyCount, limit: limits.apiKeys },
  ]

  return (
    <div className="space-y-8">
      <PageHeader
        title="Usage"
        description={`Your ${getPlanLabel(
          session?.user?.plan_tier
        )} plan limits and current usage.`}
      />

      <Card>
        <CardHeader>
          <CardTitle>This month</CardTitle>
          <CardDescription>
            Counts reset at the start of each billing cycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {meters.map((meter) => (
            <MeterRow key={meter.label} {...meter} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
