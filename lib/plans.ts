export type PlanTier = "free" | "pro";

export const PRO_PRICE = 59.9;

export type PlanLimits = {
  label: string;
  projects: number;
  chunks: number;
  questionsPerMonth: number;
  apiKeys: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    label: "Free",
    projects: 2,
    chunks: 5_000,
    questionsPerMonth: 50,
    apiKeys: 1,
  },
  pro: {
    label: "Pro",
    projects: 20,
    chunks: 100_000,
    questionsPerMonth: 1_000,
    apiKeys: 5,
  },
};

export function getPlanTier(tier: string | null | undefined): PlanTier {
  return tier === "pro" ? "pro" : "free";
}

export function getPlanLimits(tier: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[getPlanTier(tier)];
}

export function getPlanLabel(tier: string | null | undefined): string {
  return getPlanLimits(tier).label;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}
