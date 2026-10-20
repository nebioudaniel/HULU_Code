import { NextResponse } from "next/server";

import { getChapaPublicKey, isInlineCheckoutConfigured } from "@/lib/chapa";

export async function GET() {
  const inlineCheckoutEnabled = isInlineCheckoutConfigured();
  const chapaPublicKey = getChapaPublicKey();
  return NextResponse.json(
    {
      enableDemoUpgrade: process.env.ENABLE_DEMO_UPGRADE === "true",
      inlineCheckoutEnabled,
      inlineCheckoutConfigured: inlineCheckoutEnabled,
      chapaPublicKey: chapaPublicKey ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}