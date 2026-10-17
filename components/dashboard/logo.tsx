import { cn } from "@/lib/utils"

export function HuluCodeLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary text-[11px] font-bold leading-none tracking-tight text-primary-foreground"
      >
        hc
      </span>
      <span className="truncate text-[15px] font-semibold tracking-tight text-foreground group-data-[collapsible=icon]:hidden">
        hulu<span className="text-primary">C</span>ode
      </span>
    </span>
  )
}
