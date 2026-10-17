import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ensurePaymentsSchema } from "@/lib/payments";

type ChapaWebhookPayload = {
  webhook_type?: string;
  event?: string;
  status?: string;
  merchant_reference?: string;
  chapa_reference?: string;
};

function hasValidSignature(rawBody: string, received: string | null): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();

  if (!secret) return true;
  if (!received) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(req: Request) {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "CHAPA_WEBHOOK_SECRET is not set. Refusing webhooks because any request would otherwise be accepted."
      );
      return NextResponse.json(
        { error: "Webhook secret is not configured" },
        { status: 500 }
      );
    }
    console.warn(
      "CHAPA_WEBHOOK_SECRET is not set. Accepting webhooks without signature verification."
    );
  }

  try {
    const rawBody = await req.text();

    if (!hasValidSignature(rawBody, req.headers.get("x-chapa-signature"))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as ChapaWebhookPayload;

    const merchantReference = body.merchant_reference;
    const chapaReference = body.chapa_reference ?? null;
    const status = body.status;
    const event = body.event;

    if (!merchantReference) {
      return NextResponse.json({ received: true });
    }

    await ensurePaymentsSchema();

    if (event === "payment.success" || status === "success") {
      const paymentQuery = await pool.query(
        "SELECT user_id, status FROM payments WHERE tx_ref = $1",
        [merchantReference]
      );

      if (paymentQuery.rows.length > 0) {
        const { user_id, status: currentStatus } = paymentQuery.rows[0];

        if (currentStatus !== "success") {
          await pool.query(
            `UPDATE payments
             SET status = 'success', chapa_reference = COALESCE($2, chapa_reference)
             WHERE tx_ref = $1`,
            [merchantReference, chapaReference]
          );

          const planEndsAt = new Date();
          planEndsAt.setDate(planEndsAt.getDate() + 30);

          await pool.query(
            "UPDATE users SET plan_tier = 'pro', plan_ends_at = $1 WHERE id = $2",
            [planEndsAt, user_id]
          );
        }
      }
    } else if (
      event === "payment.failed" ||
      event === "payment.cancelled" ||
      event === "payment.incomplete" ||
      status === "failed" ||
      status === "cancelled" ||
      status === "incomplete"
    ) {
      await pool.query(
        "UPDATE payments SET status = 'failed' WHERE tx_ref = $1 AND status = 'pending'",
        [merchantReference]
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
