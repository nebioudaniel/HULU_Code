import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      enableDemoUpgrade: process.env.ENABLE_DEMO_UPGRADE === "true",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}