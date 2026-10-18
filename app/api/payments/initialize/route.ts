import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { auth } from "@/auth";
import { getChapaSecretKey } from "@/lib/chapa";
import { pool } from "@/lib/db";
import { isValidEmail } from "@/lib/email";
import { logError } from "@/lib/errors";
import { ensurePaymentsSchema } from "@/lib/payments";

const CHAPA_INITIALIZE_URL = "https://api.chapa.co/v1/transaction/initialize";

type ChapaInitializeResponse = {
  status?: unknown;
  message?: unknown;
  data?: {
    checkout_url?: unknown;
    chapa_reference?: unknown;
  };
};

function summarizeChapaMessage(
  message: unknown
): string | Record<string, string> | undefined {
  if (typeof message === "string") {
    return message.slice(0, 200);
  }

  if (message && typeof message === "object" && !Array.isArray(message)) {
    const summary: Record<string, string> = {};
    for (const [key, value] of Object.entries(message)) {
      const text =
        typeof value === "string"
          ? value
          : (JSON.stringify(value) ?? String(value));
      summary[key] = text.slice(0, 200);
    }
    return summary;
  }

  return undefined;
}

function isValidationMessage(message: unknown): boolean {
  return Boolean(message) && typeof message === "object";
}

function failureMessage(httpStatus: number, message: unknown): string {
  if (httpStatus === 401) {
    return "Payments are not configured correctly.";
  }

  if (httpStatus === 400 && isValidationMessage(message)) {
    return "Please check your email address and try again.";
  }

  return "Payment could not be started. Please try again later.";
}

function buildVerifyUrl(txRef: string): URL | null {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.AUTH_URL?.trim();

  if (!raw) return null;

  try {
    const url = new URL("/api/payments/verify", new URL(raw));
    url.searchParams.set("tx_ref", txRef);
    return url;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secretKey = getChapaSecretKey();
  if (!secretKey) {
    console.error("CHAPA_SECRET_KEY is not configured");
    return NextResponse.json(
      { error: "Payments are not configured correctly." },
      { status: 500 }
    );
  }

  let body: { email?: unknown; phone?: unknown } = {};
  try {
    const parsed = await req.json();
    if (parsed && typeof parsed === "object") {
      body = parsed as { email?: unknown; phone?: unknown };
    }
  } catch {}

  const sessionEmail = session.user.email;
  const email = isValidEmail(sessionEmail)
    ? sessionEmail.trim()
    : isValidEmail(body.email)
      ? body.email.trim()
      : undefined;

  if (!email) {
    return NextResponse.json(
      { error: "Please check your email address and try again." },
      { status: 400 }
    );
  }

  const nameParts = (session.user.name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const firstName = nameParts[0] || "Hulu";
  const lastName = nameParts.slice(1).join(" ") || "User";

  const rawPhone =
    typeof body.phone === "string" ? body.phone.replace(/[\s-]/g, "") : "";
  const phoneNumber = /^0[97]\d{8}$/.test(rawPhone) ? rawPhone : undefined;

  const txRef = `tx_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const amount = "59.9";
  const currency = "ETB";

  const verifyUrl = buildVerifyUrl(txRef);
  if (!verifyUrl) {
    return NextResponse.json(
      { error: "Payments are not configured correctly." },
      { status: 500 }
    );
  }

  const returnUrl = verifyUrl.toString();
  const callbackUrl = returnUrl;

  try {
    await ensurePaymentsSchema();

    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, currency, status)
       VALUES ($1, $2, $3, $4, 'pending')`,
      [session.user.id, txRef, amount, currency]
    );

    const chapaRes = await fetch(CHAPA_INITIALIZE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount,
        currency,
        email,
        first_name: firstName,
        last_name: lastName,
        ...(phoneNumber ? { phone_number: phoneNumber } : {}),
        tx_ref: txRef,
        return_url: returnUrl,
        callback_url: callbackUrl,
      }),
    });

    const chapaData = (await chapaRes.json().catch(() => null)) as
      | ChapaInitializeResponse
      | null;

    const chapaStatus =
      typeof chapaData?.status === "string" ? chapaData.status : undefined;
    const checkoutUrl =
      typeof chapaData?.data?.checkout_url === "string"
        ? chapaData.data.checkout_url
        : undefined;

    if (!chapaRes.ok || chapaStatus !== "success" || !checkoutUrl) {
      console.error({
        step: "chapa initialize",
        httpStatus: chapaRes.status,
        chapaStatus,
        chapaMessage: summarizeChapaMessage(chapaData?.message),
      });

      return NextResponse.json(
        { error: failureMessage(chapaRes.status, chapaData?.message) },
        { status: 400 }
      );
    }

    const chapaReference =
      typeof chapaData?.data?.chapa_reference === "string"
        ? chapaData.data.chapa_reference
        : null;

    if (chapaReference) {
      await pool.query(
        `UPDATE payments SET chapa_reference = $1 WHERE tx_ref = $2`,
        [chapaReference, txRef]
      );
    }

    return NextResponse.json({
      checkout_url: checkoutUrl,
      tx_ref: txRef,
    });
  } catch (error) {
    logError("Error initializing payment", error, "initialize payment");
    return NextResponse.json(
      { error: "Payment could not be started. Please try again later." },
      { status: 500 }
    );
  }
}
