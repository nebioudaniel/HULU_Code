import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { logError } from "@/lib/errors";
import { ensurePaymentsSchema } from "@/lib/payments";
import {
  getKeyKind,
  verifyWebhookSignature,
  getWebhookSignatureHeader,
  modeMatchesKeyKind,
  verifyAndFulfill,
} from "@/lib/chapa";

type ChapaWebhookPayload = {
  webhook_type?: string;
  event?: string;
  status?: string;
  merchant_reference?: string;
  chapa_reference?: string;
  mode?: string;
};

export async function POST(req: Request) {
  const keyKind = getKeyKind();
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();

  if (!secret && process.env.NODE_ENV === "production") {
    console.error(
      "CHAPA_WEBHOOK_SECRET is not set. Refusing webhooks because any request would otherwise be accepted."
    );
    return NextResponse.json(
      { error: "Webhook secret is not configured" },
      { status: 500 }
    );
  }

  try {
    const rawBody = await req.text();

    const signature = getWebhookSignatureHeader(req, keyKind);
    if (!verifyWebhookSignature(rawBody, signature, keyKind)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody) as ChapaWebhookPayload;

    if (!modeMatchesKeyKind(body.mode, keyKind)) {
      return NextResponse.json({ received: true });
    }

    const merchantReference = body.merchant_reference;
    const status = body.status;
    const event = body.event;

    if (!merchantReference) {
      return NextResponse.json({ received: true });
    }

    await ensurePaymentsSchema();

    const { rows: existingRows } = await pool.query(
      "SELECT status FROM payments WHERE tx_ref = $1",
      [merchantReference]
    );

    if (existingRows.length > 0 && existingRows[0].status === "success") {
      return NextResponse.json({ received: true });
    }

    if (event === "payment.success" || status === "success") {
      await verifyAndFulfill(merchantReference);
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
    logError("Webhook processing error", error, "process webhook");
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
