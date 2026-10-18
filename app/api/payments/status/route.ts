import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyAndFulfill } from "@/lib/chapa";
import { logError } from "@/lib/errors";

export async function GET(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const tx_ref = searchParams.get("tx_ref");

  if (!tx_ref) {
    return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
  }

  try {
    const result = await verifyAndFulfill(tx_ref, { userId: session.user.id });

    return NextResponse.json(
      { status: result.state },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logError("Payment status error", error, "check payment status");
    return NextResponse.json({ error: "Status check failed" }, { status: 500 });
  }
}
