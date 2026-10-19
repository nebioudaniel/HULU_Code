import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      directChargeEnabled:
        process.env.CHAPA_DIRECT_CHARGE_ENABLED === "true",
      enableDemoUpgrade: process.env.ENABLE_DEMO_UPGRADE === "true",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
