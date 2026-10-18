import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { logError } from "@/lib/errors";
import { ensurePaymentsSchema } from "@/lib/payments";
import {
  initiateMobileCharge,
  isMobileMoneyConfigured,
  isMockMobileMoneyEnabled,
  MOBILE_PROVIDERS,
  MOCK_CHANNEL,
} from "@/lib/chapa";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mock = isMockMobileMoneyEnabled();

  if (!isMobileMoneyConfigured() && !mock) {
    return NextResponse.json(
      {
        error:
          "Mobile money is not configured yet. Add CHAPA_V1_SECRET_KEY to the environment.",
      },
      { status: 503 }
    );
  }

  let body: { phone?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const provider = (body.provider ?? "telebirr").toLowerCase();
  if (!(MOBILE_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json(
      { error: "Unsupported payment method" },
      { status: 400 }
    );
  }

  const phone = (body.phone ?? "").replace(/[\s-]/g, "");
  if (!/^(\+?251|0)?9\d{8}$/.test(phone)) {
    return NextResponse.json(
      { error: "Enter a valid Ethiopian mobile number" },
      { status: 400 }
    );
  }

  const userId = session.user.id;
  const userName = session.user.name ?? "";
  const txRef = `tx_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const amount = 59.9;
  const currency = "ETB";

  try {
    await ensurePaymentsSchema();

    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, currency, status, channel)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
      [userId, txRef, amount, currency, mock ? MOCK_CHANNEL : provider]
    );

    if (!mock) {
      await initiateMobileCharge({
        txRef,
        amount,
        currency,
        phone,
        provider,
        email: session.user.email ?? undefined,
        firstName: userName.split(" ")[0] || undefined,
        lastName: userName.split(" ").slice(1).join(" ") || undefined,
      });
    }

    return NextResponse.json({
      tx_ref: txRef,
      mock,
      message: mock
        ? "Simulated payment (dev mode) — approving automatically."
        : "Approve the payment on your phone to finish.",
    });
  } catch (error) {
    logError("Mobile charge error", error, "start charge");

    await pool
      .query("UPDATE payments SET status = 'failed' WHERE tx_ref = $1", [txRef])
      .catch(() => undefined);

    const message =
      error instanceof Error ? error.message : "Failed to start the charge";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
