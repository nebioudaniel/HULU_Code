"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { UpgradeModal } from "@/components/UpgradeModal"

export function UpgradeToProButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button className="mt-4" onClick={() => setOpen(true)}>
        Upgrade to Pro (59.9 ETB)
      </Button>

      <UpgradeModal open={open} onOpenChange={setOpen} />
    </>
  )
}
