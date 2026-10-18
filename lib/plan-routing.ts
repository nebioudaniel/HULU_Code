export type PlanGate = "dashboard" | "select-plan";

export type PlanState = {
  authenticated: boolean;
  planChosen: boolean;
};

export type PaymentOutcome = "success" | "failed" | "pending" | "unknown";

export function redirectFor(gate: PlanGate, state: PlanState): string | null {
  if (!state.authenticated) return "/";
  if (gate === "dashboard") {
    return state.planChosen ? null : "/select-plan";
  }
  return state.planChosen ? "/dashboard" : null;
}

export function paymentDestination(outcome: PaymentOutcome): string {
  if (outcome === "success") return "/dashboard";
  if (outcome === "pending") return "/select-plan?error=payment_pending";
  if (outcome === "unknown") return "/select-plan?error=unknown_ref";
  return "/select-plan?error=payment_failed";
}

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  payment_failed:
    "The payment failed or was cancelled. You have not been charged.",
  payment_pending:
    "Your payment is still pending. Try again or continue with Free.",
  unknown_ref: "We could not find that payment. Please try again.",
  verification_error: "We could not verify the payment. Please try again.",
};

export function planErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return (
    PAYMENT_ERROR_MESSAGES[code] ?? "Something went wrong. Please try again."
  );
}
