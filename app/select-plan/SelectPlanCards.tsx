"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { UpgradeModal } from "@/components/UpgradeModal"

type PlanName = "free" | "pro"

type Plan = {
  id: PlanName
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  cta: string
  badge?: string
  highlighted?: boolean
}

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "ETB / month",
    tagline: "For trying huluCode on your own projects.",
    features: [
      "2 projects",
      "5,000 code chunks",
      "50 AI questions / month",
      "1 API key",
      "Dependency map",
      "7-day query history",
    ],
    cta: "Get started free",
  },
  {
    id: "pro",
    name: "Pro",
    price: "59.9",
    period: "ETB / month",
    tagline: "For developers working on real codebases.",
    features: [
      "20 projects",
      "100,000 code chunks",
      "1,000 AI questions / month",
      "5 API keys",
      "Dependency map",
      "Change impact analysis",
      "90-day query history",
      "Email support",
    ],
    cta: "Upgrade to Pro",
    badge: "Most popular",
    highlighted: true,
  },
]

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-primary"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const popularBadge =
  "inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground"

export function SelectPlanCards({
  initialError,
}: {
  initialError: string | null
}) {
  const router = useRouter()
  const [freeLoading, setFreeLoading] = useState(false)
  const [freeError, setFreeError] = useState<string | null>(null)
  const [paymentError, setPaymentError] = useState<string | null>(initialError)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  async function selectFree() {
    setFreeLoading(true)
    setFreeError(null)
    setPaymentError(null)

    try {
      const res = await fetch("/api/user/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error ?? "Failed to update plan")
      }

      router.push("/dashboard")
    } catch (err) {
      setFreeError(err instanceof Error ? err.message : "Something went wrong")
      setFreeLoading(false)
    }
  }

  return (
    <div>
      <div className="mt-14 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2">
        {plans.map((plan) => {
          const isPro = plan.id === "pro"

          return (
            <article
              key={plan.id}
              className={
                "relative flex flex-col rounded-2xl border bg-transparent p-6 transition-colors duration-300 " +
                (plan.highlighted
                  ? "border-primary/50"
                  : "border-neutral-200 hover:border-neutral-300")
              }
            >
              <div className="flex h-6 items-center">
                {plan.badge && (
                  <span className={popularBadge}>{plan.badge}</span>
                )}
              </div>

              <h3 className="mt-3 text-base font-semibold text-neutral-900">
                {plan.name}
              </h3>

              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-neutral-900">
                  {plan.price}
                </span>
                <span className="text-sm text-neutral-500">{plan.period}</span>
              </div>

              <p className="mt-2 text-sm leading-relaxed text-neutral-500">
                {plan.tagline}
              </p>

              <Button
                variant={plan.highlighted ? "default" : "outline"}
                className="mt-6 w-full rounded-lg"
                disabled={!isPro && freeLoading}
                onClick={isPro ? () => setCheckoutOpen(true) : selectFree}
              >
                {!isPro && freeLoading ? "Processing…" : plan.cta}
              </Button>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-neutral-600"
                  >
                    <CheckIcon />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {paymentError && (
        <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-sm text-destructive">{paymentError}</p>
          <Button
            variant="outline"
            className="mt-3 rounded-lg"
            disabled={freeLoading}
            onClick={selectFree}
          >
            {freeLoading ? "Processing…" : "Continue with Free"}
          </Button>
        </div>
      )}

      {freeError && (
        <p className="mt-6 text-center text-sm text-destructive">{freeError}</p>
      )}

      <p className="mt-8 text-center text-xs text-neutral-500">
        Pro is billed monthly in ETB via Chapa. Cancel anytime.
      </p>

      <UpgradeModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        onSuccess={() => router.push("/dashboard")}
        onFailure={() => {
          setCheckoutOpen(false)
          setPaymentError(
            "The payment failed or was cancelled. You have not been charged."
          )
        }}
      />
    </div>
  )
}
