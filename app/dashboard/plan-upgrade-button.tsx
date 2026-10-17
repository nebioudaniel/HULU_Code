"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { UpgradeModal } from "@/components/UpgradeModal"
import { cn } from "@/lib/utils"

export function PlanUpgradeButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        type="button"
        className={cn("w-full rounded-lg", className)}
        onClick={() => setOpen(true)}
      >
        Upgrade
      </Button>

      <UpgradeModal open={open} onOpenChange={setOpen} />
    </>
  )
}
