"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"
import { UpgradeModal } from "@/components/UpgradeModal"

type PlanCtaProps = {
  label: string
  plan: "free" | "pro" | "team"
  highlighted?: boolean
  disabled?: boolean
}

export function PlanCta({ label, plan, highlighted, disabled }: PlanCtaProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  function handleClick() {
    if (status === "loading") return

    if (!session) {
      signIn("github", { callbackUrl: "/dashboard" })
      return
    }

    if (plan === "free" || session.user.plan_tier === "pro") {
      router.push("/dashboard")
      return
    }

    if (session.user.plan_chosen) {
      setUpgradeOpen(true)
      return
    }

    router.push("/select-plan")
  }

  if (disabled) {
    return (
      <Button variant="outline" disabled className="mt-6 w-full rounded-lg">
        {label}
      </Button>
    )
  }

  return (
    <>
      <Button
        variant={highlighted ? "default" : "outline"}
        className="mt-6 w-full rounded-lg"
        disabled={status === "loading"}
        onClick={handleClick}
      >
        {label}
      </Button>

      {plan === "pro" && (
        <UpgradeModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          onSuccess={() => router.push("/dashboard")}
        />
      )}
    </>
  )
}
