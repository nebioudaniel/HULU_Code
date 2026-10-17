import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { ensurePaymentsSchema } from "@/lib/payments";

const CHAPA_BASE_URL = "https://api.chapa.global/v2";

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const userEmail = session.user.email || "user@example.com";
  const userName = session.user.name || "Customer";

  const secretKey = process.env.CHAPA_SECRET_KEY?.trim();
  if (!secretKey) {
    console.error("CHAPA_SECRET_KEY is not configured");
    return NextResponse.json(
      { error: "Payment provider is not configured" },
      { status: 500 }
    );
  }

  const merchantReference = `tx_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const amount = 59.9;
  const currency = "ETB";

  try {
    await ensurePaymentsSchema();

    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [userId, merchantReference, amount, currency]
    );

    const chapaRes = await fetch(`${CHAPA_BASE_URL}/payments/hosted`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        merchant_reference: merchantReference,
        customer: {
          first_name: userName.split(" ")[0] || "Customer",
          last_name: userName.split(" ").slice(1).join(" ") || "User",
          email: userEmail,
        },
        meta: {
          user_id: userId,
          plan: "pro",
        },
      }),
    });

    const chapaData = await chapaRes.json();

    if (
      !chapaRes.ok ||
      chapaData.status !== "success" ||
      !chapaData.data?.checkout_url
    ) {
      console.error("Chapa initialize failed:", chapaData);
      return NextResponse.json(
        { error: chapaData.message || "Failed to initialize payment" },
        { status: 400 }
      );
    }

    const checkoutUrl: string = chapaData.data.checkout_url;

    const chapaReference: string | null =
      chapaData.data.chapa_reference ||
      checkoutUrl.split("/").filter(Boolean).pop() ||
      null;

    if (chapaReference) {
      await pool.query(
        `UPDATE payments SET chapa_reference = $1 WHERE tx_ref = $2`,
        [chapaReference, merchantReference]
      );
    }

    return NextResponse.json({
      checkout_url: checkoutUrl,
      tx_ref: merchantReference,
    });
  } catch (error) {
    console.error("Error initializing payment:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
