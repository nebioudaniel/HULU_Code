"use client"

import Link from "next/link"
import { signIn, signOut, useSession } from "next-auth/react"

import { Button } from "@/components/ui/button"

export default function LoginBtn() {
  const { data: session } = useSession()

  if (session) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden text-[13px] text-neutral-500 sm:inline">
          Welcome,{" "}
          <strong className="font-semibold text-neutral-900">
            {session.user.name}
          </strong>
        </span>
        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 ring-1 ring-inset ring-neutral-200">
          {session.user.plan_tier}
        </span>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Go to dashboard</Link>
        </Button>
        <Button variant="outline" size="sm" onClick={() => signOut()}>
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <Button size="sm" onClick={() => signIn("github", { callbackUrl: "/dashboard" })}>
      Sign in with GitHub
    </Button>
  )
}
