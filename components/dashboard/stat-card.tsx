import type { LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  quiet = false,
  className,
}: {
  label: string
  value: number | string
  icon?: LucideIcon
  hint?: string
  quiet?: boolean
  className?: string
}) {
  return (
    <Card className={cn("shadow-xs", className)}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p
            className={cn(
              "text-3xl leading-none font-semibold tabular-nums",
              quiet ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {value}
          </p>
          {hint && (
            <p className="truncate text-sm text-muted-foreground">{hint}</p>
          )}
        </div>
        {Icon && (
          <div
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          >
            <Icon className="size-4" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
