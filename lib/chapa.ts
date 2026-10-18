import { pool } from "@/lib/db";
import { ensurePaymentsSchema } from "@/lib/payments";

const CHAPA_V2_BASE_URL = "https://api.chapa.global/v2";
const CHAPA_V1_BASE_URL = "https://api.chapa.co/v1";

export type PaymentState = "success" | "failed" | "pending" | "unknown";

export type VerifyResult = {
  state: PaymentState;
  userId?: string;
};

const FAILED_STATES = ["failed", "cancelled", "incomplete", "blocked"];

export const MOBILE_PROVIDERS = [
  "telebirr",
  "mpesa",
  "cbebirr",
  "awashbirr",
  "yaya",
] as const;

export type MobileProvider = (typeof MOBILE_PROVIDERS)[number];

export const MOCK_CHANNEL = "mock";

export function isMobileMoneyConfigured(): boolean {
  return Boolean(process.env.CHAPA_V1_SECRET_KEY?.trim());
}

export function isMockMobileMoneyEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.ENABLE_MOCK_PAYMENTS === "true" && !isMobileMoneyConfigured()
  );
}

function getV1Key(): string {
  const key = process.env.CHAPA_V1_SECRET_KEY?.trim();
  if (!key) {
    throw new Error("CHAPA_V1_SECRET_KEY is not configured");
  }
  return key;
}

export type InitiateMobileChargeInput = {
  txRef: string;
  amount: number;
  currency: string;
  phone: string;
  provider: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

export async function initiateMobileCharge(
  input: InitiateMobileChargeInput
): Promise<void> {
  const form = new FormData();
  form.append("amount", String(input.amount));
  form.append("currency", input.currency);
  form.append("tx_ref", input.txRef);
  form.append("mobile", input.phone);
  if (input.email) form.append("email", input.email);
  if (input.firstName) form.append("first_name", input.firstName);
  if (input.lastName) form.append("last_name", input.lastName);

  const res = await fetch(
    `${CHAPA_V1_BASE_URL}/charges?type=${encodeURIComponent(input.provider)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getV1Key()}` },
      body: form,
    }
  );

  const data = await res.json().catch(() => null);

  if (!res.ok || data?.status !== "success") {
    throw new Error(data?.message || "Failed to start the mobile money charge");
  }
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
    `SELECT user_id, chapa_reference, status, channel FROM payments WHERE ${where}`,
    params
  );

  if (rows.length === 0) {
    return { state: "unknown" };
  }

  const { user_id, chapa_reference, status, channel } = rows[0] as {
    user_id: string;
    chapa_reference: string | null;
    status: string;
    channel: string | null;
  };

  if (status === "success") {
    return { state: "success", userId: user_id };
  }

  if (channel === MOCK_CHANNEL) {
    await fulfillPro(txRef, user_id);
    return { state: "success", userId: user_id };
  }

  const isMobile = Boolean(channel) && channel !== "hosted";

  return isMobile
    ? verifyMobileCharge(txRef, user_id)
    : verifyHostedPayment(txRef, user_id, chapa_reference);
}

async function verifyHostedPayment(
  txRef: string,
  userId: string,
  chapaReference: string | null
): Promise<VerifyResult> {
  const secretKey = process.env.CHAPA_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("CHAPA_SECRET_KEY is not configured");
  }

  const reference = chapaReference || txRef;

  const res = await fetch(
    `${CHAPA_V2_BASE_URL}/payments/${encodeURIComponent(reference)}/verify`,
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  const data = await res.json().catch(() => null);
  const chapaStatus: string | undefined = data?.data?.status;

  if (data?.status === "success" && chapaStatus === "success") {
    await fulfillPro(txRef, userId);
    return { state: "success", userId };
  }

  if (chapaStatus && FAILED_STATES.includes(chapaStatus)) {
    await markFailed(txRef);
    return { state: "failed", userId };
  }

  return { state: "pending", userId };
}

async function verifyMobileCharge(
  txRef: string,
  userId: string
): Promise<VerifyResult> {
  const res = await fetch(
    `${CHAPA_V1_BASE_URL}/transaction/verify/${encodeURIComponent(txRef)}`,
    { headers: { Authorization: `Bearer ${getV1Key()}` } }
  );

  const data = await res.json().catch(() => null);
  const chapaStatus: string | undefined = data?.data?.status;

  if (data?.status === "success" && chapaStatus === "success") {
    await fulfillPro(txRef, userId);
    return { state: "success", userId };
  }

  if (chapaStatus && FAILED_STATES.includes(chapaStatus)) {
    await markFailed(txRef);
    return { state: "failed", userId };
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
