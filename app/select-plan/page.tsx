import { redirect } from "next/navigation"
import { connection } from "next/server"

import { auth } from "@/auth"
import { planErrorMessage, redirectFor } from "@/lib/plan-routing"
import { SelectPlanCards } from "./SelectPlanCards"

export default async function SelectPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()

  const session = await auth()
  const destination = redirectFor("select-plan", {
    authenticated: Boolean(session?.user?.id),
    planChosen: Boolean(session?.user?.plan_chosen),
  })

  if (destination) {
    redirect(destination)
  }

  const query = await searchParams
  const code = typeof query.error === "string" ? query.error : undefined

  return (
    <section className="mx-auto w-full max-w-4xl px-6 py-24">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl">
          Choose your plan
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          Start free. Upgrade to Pro when your codebase grows.
        </p>
      </div>

      <SelectPlanCards initialError={planErrorMessage(code)} />
    </section>
  )
}
