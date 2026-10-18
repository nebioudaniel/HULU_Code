import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      directChargeEnabled:
        process.env.CHAPA_DIRECT_CHARGE_ENABLED === "true",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
