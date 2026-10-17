import { NextResponse } from "next/server";
import { verifyAndFulfill } from "@/lib/chapa";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tx_ref = searchParams.get("tx_ref");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (!tx_ref) {
    return NextResponse.redirect(`${appUrl}/dashboard?error=missing_ref`);
  }

  try {
    const result = await verifyAndFulfill(tx_ref);

    if (result.state === "success") {
      return NextResponse.redirect(`${appUrl}/dashboard?payment=success`);
    }

    if (result.state === "unknown") {
      return NextResponse.redirect(`${appUrl}/dashboard?error=unknown_ref`);
    }

    return NextResponse.redirect(`${appUrl}/select-plan?error=payment_failed`);
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.redirect(`${appUrl}/dashboard?error=verification_error`);
  }
}
