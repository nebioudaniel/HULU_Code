import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { logError } from "@/lib/errors";
import { ensurePaymentsSchema } from "@/lib/payments";

const CHAPA_V1_BASE_URL = "https://api.chapa.co/v1";
const PRO_PRICE = 59.9;
const PRO_CURRENCY = "ETB";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tx_ref?: unknown; amount?: unknown; currency?: unknown; email?: unknown };
  try {
    body = (await req.json()) as { tx_ref?: unknown; amount?: unknown; currency?: unknown; email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const txRef = typeof body.tx_ref === "string" ? body.tx_ref : undefined;
  if (!txRef) {
    return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
  }

  await ensurePaymentsSchema();

  const existing = await pool.query(
    "SELECT status FROM payments WHERE tx_ref = $1 AND user_id = $2",
    [txRef, session.user.id]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === "success") {
    return NextResponse.json({ status: "success", tx_ref: txRef });
  }

  try {
    const chapaRes = await fetch(
      `${CHAPA_V1_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY?.trim()}`,
        },
      }
    );

    const chapaData = (await chapaRes.json().catch(() => null)) as {
      status?: unknown;
      data?: { status?: unknown; amount?: unknown; currency?: unknown };
    };

    const chapaStatus =
      typeof chapaData?.data?.status === "string"
        ? chapaData.data.status
        : undefined;
    const rawAmount = chapaData?.data?.amount;
    const amount =
      typeof rawAmount === "number"
        ? rawAmount
        : typeof rawAmount === "string"
          ? parseFloat(rawAmount)
          : undefined;
    const currency =
      typeof chapaData?.data?.currency === "string"
        ? chapaData.data.currency
        : undefined;

    if (
      chapaData?.status !== "success" ||
      chapaStatus !== "success" ||
      amount !== PRO_PRICE ||
      currency !== PRO_CURRENCY
    ) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    const planEndsAt = new Date();
    planEndsAt.setDate(planEndsAt.getDate() + 30);

    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, currency, status, channel)
       VALUES ($1, $2, $3, $4, 'success', $5)
       ON CONFLICT (tx_ref) DO UPDATE SET status = 'success'`,
      [session.user.id, txRef, amount, currency, "inline"]
    );

    await pool.query(
      `UPDATE users
       SET plan_tier = 'pro', plan_ends_at = $1, plan_chosen = true
       WHERE id = $2`,
      [planEndsAt, session.user.id]
    );

    return NextResponse.json({ status: "success", tx_ref: txRef });
  } catch (error) {
    logError("Inline verify failed", error, "inline verify");
    return NextResponse.json(
      { error: "Payment verification failed" },
      { status: 500 }
    );
  }
}
