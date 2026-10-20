import crypto from "node:crypto";
import { pool } from "./db.ts";
import { ensurePaymentsSchema } from "./payments.ts";

const CHAPA_V1_BASE_URL = "https://api.chapa.co/v1";
const CHAPA_V2_BASE_URL = "https://api.chapa.global/v2";
const PRO_PRICE = 49.9;
const PRO_CURRENCY = "ETB";

export type PaymentState = "success" | "failed" | "pending" | "unknown";
export type KeyKind = "v2test" | "v2live" | "v1test" | "v1live" | "v1" | "public" | "unknown";

export type VerifyResult = {
  state: PaymentState;
  userId?: string;
};

const FAILED_STATES = ["failed", "cancelled", "incomplete", "blocked"];

export const MOCK_CHANNEL = "mock";

export function getChapaSecretKey(): string | undefined {
  const raw = process.env.CHAPA_SECRET_KEY?.trim();
  if (!raw) return undefined;
  return raw.replace(/^["']|["']$/g, "").trim();
}

export function detectKeyKind(key: string): KeyKind {
  if (key.startsWith("CHAPA_TEST_")) return "v2test";
  if (key.startsWith("CHAPA_LIVE_")) return "v2live";
  if (key.startsWith("CHASECK_TEST")) return "v1test";
  if (key.startsWith("CHASECK_LIVE")) return "v1live";
  if (key.startsWith("CHASECK")) return "v1";
  if (key.startsWith("CHAPUBK")) return "public";
  return "unknown";
}

export function getKeyKind(): KeyKind | undefined {
  const key = getChapaSecretKey();
  if (!key) return undefined;
  return detectKeyKind(key);
}

export function getChapaPublicKey(): string | undefined {
  const raw =
    process.env.NEXT_PUBLIC_CHAPA_PUBLIC_KEY?.trim() ||
    process.env.CHAPA_PUBLIC_KEY?.trim() ||
    process.env.CHAPA_PUBLISHABLE_KEY?.trim();
  if (!raw) return undefined;
  return raw.replace(/^["']|["']$/g, "").trim();
}

export function isInlineCheckoutConfigured(): boolean {
  return Boolean(getChapaPublicKey());
}

export function isInlineCheckoutEnabled(): boolean {
  return isInlineCheckoutConfigured();
}


export async function verifyAndFulfill(
  txRef: string,
  opts: { userId?: string } = {}
): Promise<VerifyResult> {
  await ensurePaymentsSchema();

  const params: unknown[] = [txRef];
  let where = "tx_ref = $1";
  if (opts.userId) {
    params.push(opts.userId);
    where += " AND user_id = $2";
  }

  const { rows } = await pool.query(
    `SELECT user_id, status, channel, chapa_reference FROM payments WHERE ${where}`,
    params
  );

  if (rows.length === 0) {
    return { state: "unknown" };
  }

  const { user_id, status, channel, chapa_reference } = rows[0] as {
    user_id: string;
    status: string;
    channel: string | null;
    chapa_reference: string | null;
  };

  if (status === "success") {
    return { state: "success", userId: user_id };
  }

  if (channel === MOCK_CHANNEL) {
    await fulfillPro(txRef, user_id);
    return { state: "success", userId: user_id };
  }

  const keyKind = getKeyKind();
  if (keyKind === "v2test" || keyKind === "v2live") {
    return verifyHostedPaymentV2(txRef, user_id, chapa_reference);
  }

  return verifyHostedPayment(txRef, user_id);
}

async function verifyHostedPaymentV2(
  txRef: string,
  userId: string,
  chapaReference: string | null
): Promise<VerifyResult> {
  if (!chapaReference) {
    return { state: "pending", userId };
  }

  const key = getChapaSecretKey();
  if (!key) {
    throw new Error("Payments are not configured correctly");
  }
  const kind = detectKeyKind(key);
  if (kind !== "v2test" && kind !== "v2live") {
    throw new Error("Payments are not configured correctly");
  }

  const res = await fetch(
    `${CHAPA_V2_BASE_URL}/payments/${encodeURIComponent(chapaReference)}/verify`,
    {
      headers: { Authorization: `Bearer ${key}` },
    }
  );

  const data = await res.json().catch(() => null);
  const dataObj = data?.data ?? data;
  const chapaStatus: string | undefined =
    typeof dataObj?.status === "string" ? dataObj.status : undefined;
  const rawAmount = dataObj?.amount;
  const amount =
    typeof rawAmount === "number"
      ? rawAmount
      : typeof rawAmount === "string"
        ? parseFloat(rawAmount)
        : undefined;
  const currency =
    typeof dataObj?.currency === "string" ? dataObj.currency : undefined;
  const merchantReference =
    typeof dataObj?.merchant_reference === "string"
      ? dataObj.merchant_reference
      : undefined;

  if (
    chapaStatus === "success" &&
    amount === PRO_PRICE &&
    currency === PRO_CURRENCY &&
    merchantReference === txRef
  ) {
    await fulfillPro(txRef, userId);
    return { state: "success", userId };
  }

  if (chapaStatus === "success") {
    console.error("chapa verify mismatch", {
      step: "chapa verify mismatch",
      expectedAmount: PRO_PRICE,
      receivedAmount: amount,
      expectedCurrency: PRO_CURRENCY,
      receivedCurrency: currency,
      mode: kind,
    });
  } else {
    logChapaError({
      step: "chapa v2 verify",
      api: "v2",
      keyKind: kind,
      httpStatus: res.status,
      chapaStatus,
      chapaMessage: data?.message,
    });
  }

  return { state: "pending", userId };
}

async function verifyHostedPayment(
  txRef: string,
  userId: string
): Promise<VerifyResult> {
  const secretKey = getChapaSecretKey();
  if (!secretKey) {
    throw new Error("CHAPA_SECRET_KEY is not configured");
  }

  const res = await fetch(
    `${CHAPA_V1_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    }
  );

  const data = await res.json().catch(() => null);
  const chapaStatus: string | undefined = data?.data?.status;
  const kind = detectKeyKind(secretKey);

  if (data?.status === "success" && chapaStatus === "success") {
    await fulfillPro(txRef, userId);
    return { state: "success", userId };
  }

  if (!res.ok) {
    logChapaError({
      step: "chapa v1 verify",
      api: "v1",
      keyKind: kind,
      httpStatus: res.status,
      chapaStatus,
      chapaMessage: data?.message,
    });
  } else if (chapaStatus && FAILED_STATES.includes(chapaStatus)) {
    await markFailed(txRef);
    logChapaError({
      step: "chapa v1 verify",
      api: "v1",
      keyKind: kind,
      httpStatus: res.status,
      chapaStatus,
      chapaMessage: data?.message,
    });
    return { state: "failed", userId };
  } else {
    logChapaError({
      step: "chapa v1 verify",
      api: "v1",
      keyKind: kind,
      httpStatus: res.status,
      chapaStatus,
      chapaMessage: data?.message,
    });
  }

  return { state: "pending", userId };
}

async function markFailed(txRef: string): Promise<void> {
  await pool.query(
    "UPDATE payments SET status = 'failed' WHERE tx_ref = $1 AND status = 'pending'",
    [txRef]
  );
}

async function fulfillPro(txRef: string, userId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE payments
        SET status = 'success'
      WHERE tx_ref = $1 AND status <> 'success'
      RETURNING user_id`,
    [txRef]
  );

  if (result.rows.length === 0) {
    return;
  }

  const planEndsAt = new Date();
  planEndsAt.setDate(planEndsAt.getDate() + 30);

  await pool.query(
    `UPDATE users
     SET plan_tier = 'pro', plan_ends_at = $1, plan_chosen = true
     WHERE id = $2`,
    [planEndsAt, userId]
  );
}

function summarizeChapaMessageForLog(message: unknown): unknown {
  if (typeof message === "string") {
    return message.slice(0, 200);
  }
  if (message && typeof message === "object" && !Array.isArray(message)) {
    const obj = message as Record<string, unknown>;
    const keys = Object.keys(obj);
    const messages: Record<string, string> = {};
    for (const key of keys) {
      const value = obj[key];
      messages[key] =
        typeof value === "string" ? value.slice(0, 200) : String(value).slice(0, 200);
    }
    return { keys, messages };
  }
  return undefined;
}

export function logChapaError(params: {
  step: string;
  api: "v1" | "v2";
  keyKind: KeyKind | undefined;
  httpStatus?: number;
  chapaStatus?: string | undefined;
  errorCode?: string | undefined;
  chapaMessage?: unknown;
}): void {
  console.error("chapa error", {
    step: params.step,
    api: params.api,
    keyKind: params.keyKind,
    httpStatus: params.httpStatus,
    chapaStatus: params.chapaStatus,
    errorCode: params.errorCode,
    chapaMessage: summarizeChapaMessageForLog(params.chapaMessage),
  });
}

let v2ResponseKeysLogged = false;

function logV2ResponseKeysOnce(data: unknown): void {
  if (v2ResponseKeysLogged) return;
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    console.error("chapa v2 response keys", {
      step: "chapa v2 initialize",
      keys: Object.keys(obj),
    });
    if (obj.data && typeof obj.data === "object") {
      const dataObj = obj.data as Record<string, unknown>;
      console.error("chapa v2 response data keys", {
        step: "chapa v2 initialize",
        keys: Object.keys(dataObj),
      });
    }
  }
  v2ResponseKeysLogged = true;
}

export type InitializeV2Input = {
  txRef: string;
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  userId: string;
};

export async function initializeV2Hosted(
  input: InitializeV2Input
): Promise<{ checkoutUrl: string; chapaReference: string | null }> {
  const key = getChapaSecretKey();
  if (!key) {
    throw new Error("Payments are not configured correctly");
  }
  const kind = detectKeyKind(key);
  if (kind !== "v2test" && kind !== "v2live") {
    console.error("Payments are not configured correctly", {
      step: "chapa key shape",
      present: true,
      length: key.length,
      kind,
    });
    throw new Error("Payments are not configured correctly");
  }

  const customer: Record<string, unknown> = {
    first_name: input.firstName || "Hulu",
    last_name: input.lastName || "User",
    email: input.email,
  };

  if (input.phoneNumber && /^\+2519\d{8}$/.test(input.phoneNumber)) {
    customer.phone_number = input.phoneNumber;
  }

  const body = {
    amount: input.amount,
    currency: input.currency,
    merchant_reference: input.txRef,
    customer,
    meta: {
      user_id: input.userId,
      plan: "pro",
    },
  };

  const res = await fetch(`${CHAPA_V2_BASE_URL}/payments/hosted`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  logV2ResponseKeysOnce(data ?? {});

  if (!res.ok || data?.status !== "success") {
    const errorCode = data?.error?.code;
    const message = typeof data?.message === "string" ? data.message : "";
    const kind = detectKeyKind(getChapaSecretKey() ?? "");
    logChapaError({
      step: "chapa v2 initialize",
      api: "v2",
      keyKind: kind,
      httpStatus: res.status,
      chapaStatus: data?.status,
      errorCode,
      chapaMessage: data?.message,
    });

    if (errorCode === "INVALID_VALUE" && /email/i.test(message)) {
      throw new Error("Please check your email address and try again.");
    }
    if (
      errorCode === "ENVIRONMENT_MISMATCH" ||
      /environment/i.test(String(errorCode ?? ""))
    ) {
      throw new Error("Payments are not configured correctly.");
    }
    throw new Error("Payment could not be started. Please try again later.");
  }

  const dataObj = data?.data ?? data;
  const checkoutUrl =
    typeof dataObj?.checkout_url === "string" ? dataObj.checkout_url : undefined;
  if (!checkoutUrl) {
    throw new Error("Payment could not be started. Please try again later.");
  }

  let chapaReference: string | null = null;
  if (typeof dataObj?.chapa_reference === "string") {
    chapaReference = dataObj.chapa_reference;
  } else if (typeof dataObj?.reference === "string") {
    chapaReference = dataObj.reference;
  } else if (typeof dataObj?.id === "string") {
    chapaReference = dataObj.id;
  } else {
    chapaReference = checkoutUrl.split("/").pop() ?? null;
  }

  return { checkoutUrl, chapaReference: chapaReference ?? null };
}

export function buildV2InitializeBody(input: {
  amount: number;
  currency: string;
  merchantReference: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  userId: string;
}): Record<string, unknown> {
  const customer: Record<string, unknown> = {
    first_name: input.firstName || "Hulu",
    last_name: input.lastName || "User",
    email: input.email,
  };

  if (input.phoneNumber && /^\+2519\d{8}$/.test(input.phoneNumber)) {
    customer.phone_number = input.phoneNumber;
  }

  return {
    amount: input.amount,
    currency: input.currency,
    merchant_reference: input.merchantReference,
    customer,
    meta: {
      user_id: input.userId,
      plan: "pro",
    },
  };
}

export function mapV2ErrorCode(
  errorCode: string | undefined,
  message: unknown
): string {
  if (errorCode === "INVALID_VALUE" && typeof message === "string" && /email/i.test(message)) {
    return "Please check your email address and try again.";
  }
  if (
    errorCode === "ENVIRONMENT_MISMATCH" ||
    /environment/i.test(String(errorCode ?? ""))
  ) {
    return "Payments are not configured correctly.";
  }
  return "Payment could not be started. Please try again later.";
}

export function verifyWebhookSignature(
  rawBody: string,
  receivedSignature: string | null,
  _keyKind: KeyKind | undefined
): boolean {
  const secret = process.env.CHAPA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return false;
    }
    return true;
  }

  if (!receivedSignature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");
  const receivedBuffer = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (receivedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function getWebhookSignatureHeader(
  req: { headers: { get: (name: string) => string | null } },
  keyKind: KeyKind | undefined
): string | null {
  const isV1 =
    keyKind === "v1test" || keyKind === "v1live" || keyKind === "v1";
  if (isV1) {
    return req.headers.get("chapa-signature") ?? req.headers.get("x-chapa-signature");
  }
  return req.headers.get("x-chapa-signature");
}

export function modeMatchesKeyKind(
  mode: string | undefined,
  keyKind: KeyKind | undefined
): boolean {
  if (!mode || !keyKind) return true;
  if (mode === "test") {
    return keyKind === "v2test" || keyKind === "v1test" || keyKind === "v1";
  }
  if (mode === "live") {
    return keyKind === "v2live" || keyKind === "v1live" || keyKind === "v1";
  }
  return true;
}
