"use client"

import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { signIn, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"

export function GetStartedButton() {
  const { data: session } = useSession()
  const router = useRouter()

  function handleClick() {
    if (session) {
      if (session.user.plan_tier === "pro") {
        router.push("/dashboard")
      } else {
        router.push("/select-plan")
      }
    } else {
      signIn("github", { callbackUrl: "/select-plan" })
    }
  }

  return (
    <Button
      onClick={handleClick}
      className="h-11 gap-2.5 rounded-full px-5 text-[12px] font-semibold uppercase tracking-wide"
    >
      Sign up with GitHub
      <span className="flex size-6 items-center justify-center rounded-full border border-primary-foreground/25">
        <ArrowRight className="size-3.5" />
      </span>
    </Button>
  )
}
