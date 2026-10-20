"use client"

import { cn } from "@/lib/utils"
import { symbolKindColors } from "@/lib/colors"

export function SymbolKindBadge({ kind }: { kind: string }) {
  const { bg, border, text } = symbolKindColors(kind)
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold", bg, border, text)}>
      {kind.charAt(0).toUpperCase() + kind.slice(1)}
    </span>
  )
}
