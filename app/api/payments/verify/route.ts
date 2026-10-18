import { NextResponse } from "next/server";
import { verifyAndFulfill } from "@/lib/chapa";
import { logError } from "@/lib/errors";
import { paymentDestination } from "@/lib/plan-routing";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tx_ref = searchParams.get("tx_ref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (!tx_ref) {
    return NextResponse.redirect(
      `${appUrl}${paymentDestination("unknown")}`
    );
  }

  try {
    const result = await verifyAndFulfill(tx_ref);
    const destination =
      result.state === "success"
        ? "/dashboard?payment=success"
        : paymentDestination(result.state);

    return NextResponse.redirect(`${appUrl}${destination}`);
  } catch (error) {
    logError("Payment verification failed", error, "verify payment");
    return NextResponse.redirect(
      `${appUrl}/select-plan?error=verification_error`
    );
  }
}
