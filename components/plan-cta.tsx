"use client"

import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"

type PlanCtaProps = {
  label: string
  highlighted?: boolean
  disabled?: boolean
}

export function PlanCta({ label, highlighted, disabled }: PlanCtaProps) {
  const { data: session, status } = useSession()
  const router = useRouter()

  function handleClick() {
    if (status === "loading") return

    if (!session) {
      signIn("github", { callbackUrl: "/select-plan" })
      return
    }

    if (session.user.plan_tier === "pro") {
      router.push("/dashboard")
    } else {
      router.push("/select-plan")
    }
  }

  if (disabled) {
    return (
      <Button variant="outline" disabled className="mt-6 w-full rounded-lg">
        {label}
      </Button>
    )
  }

  return (
    <Button
      variant={highlighted ? "default" : "outline"}
      className="mt-6 w-full rounded-lg"
      disabled={status === "loading"}
      onClick={handleClick}
    >
      {label}
    </Button>
  )
}
