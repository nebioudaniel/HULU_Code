"use client"

import { useState } from "react"
import { HelpCircle } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type PageHelperProps = {
  text: string
}

export function PageHelper({ text }: PageHelperProps) {
  const [open, setOpen] = useState(false)
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">How this page works</span>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <HelpCircle className="size-3.5 text-muted-foreground cursor-help" aria-hidden />
        </TooltipTrigger>
        <TooltipContent side="top">{text}</TooltipContent>
      </Tooltip>
    </span>
  )
}
