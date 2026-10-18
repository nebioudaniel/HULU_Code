import { PlanCta } from "@/components/plan-cta"

type Plan = {
  id: "free" | "pro" | "team"
  name: string
  price: string
  period: string
  tagline: string
  features: string[]
  cta: { label: string; disabled?: boolean }
  badge?: string
  highlighted?: boolean
  dimmed?: boolean
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
    cta: { label: "Get started free" },
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
    cta: { label: "Upgrade to Pro" },
    badge: "Most popular",
    highlighted: true,
  },
  {
    id: "team",
    name: "Team",
    price: "99.9",
    period: "ETB / user / month",
    tagline: "For teams that share one codebase view.",
    features: [
      "Unlimited projects",
      "1,000,000+ code chunks",
      "5,000 AI questions / user / month",
      "20 API keys",
      "Shared workspace",
      "1-year query history",
      "Priority support",
    ],
    cta: { label: "Join waitlist", disabled: true },
    badge: "Coming soon",
    dimmed: true,
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
const soonBadge =
  "inline-flex items-center rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-500 ring-1 ring-inset ring-neutral-200"

export function Pricing() {
  return (
    <section
      id="pricing"
      aria-labelledby="pricing-heading"
      className="mx-auto w-full max-w-6xl scroll-mt-12 px-6 py-24"
    >
      <div className="max-w-2xl">
        <h2
          id="pricing-heading"
          className="text-2xl font-semibold tracking-tight text-neutral-900 sm:text-3xl"
        >
          Simple pricing
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-neutral-500">
          Start free. Upgrade when your codebase grows.
        </p>
      </div>

      <div className="mt-14 grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <article
            key={plan.name}
            className={
              "relative flex flex-col rounded-2xl border bg-transparent p-6 transition-colors duration-300 " +
              (plan.highlighted
                ? "border-primary/50"
                : "border-neutral-200 hover:border-neutral-300") +
              (plan.dimmed ? " opacity-60" : "")
            }
          >
            <div className="flex h-6 items-center">
              {plan.badge && (
                <span
                  className={plan.highlighted ? popularBadge : soonBadge}
                >
                  {plan.badge}
                </span>
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

            <PlanCta
              label={plan.cta.label}
              plan={plan.id}
              highlighted={plan.highlighted}
              disabled={plan.cta.disabled}
            />

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
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-neutral-500">
        Prices in USD. Local payment in ETB available at checkout via Chapa.
      </p>
    </section>
  )
}
