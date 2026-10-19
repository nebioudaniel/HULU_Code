import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { ensurePaymentsSchema } from "@/lib/payments";
import { logError } from "@/lib/errors";

export async function POST(req: Request) {
  if (process.env.ENABLE_DEMO_UPGRADE !== "true") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await ensurePaymentsSchema();

  const existing = await pool.query(
    "SELECT id, status FROM payments WHERE user_id = $1 AND status IN ('demo', 'success') ORDER BY created_at DESC LIMIT 1",
    [session.user.id]
  );

  if (existing.rows.length > 0 && existing.rows[0].status === "success") {
    return NextResponse.json({ tx_ref: existing.rows[0].id, demo: true });
  }

  if (existing.rows.length > 0 && existing.rows[0].status === "demo") {
    return NextResponse.json({ tx_ref: existing.rows[0].id, demo: true });
  }

  const txRef = `demo_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  const planEndsAt = new Date();
  planEndsAt.setDate(planEndsAt.getDate() + 30);

  try {
    await pool.query(
      `INSERT INTO payments (user_id, tx_ref, amount, currency, status, channel)
       VALUES ($1, $2, $3, $4, 'demo', $5)`,
      [session.user.id, txRef, 0, "ETB", "demo"]
    );

    await pool.query(
      `UPDATE users
       SET plan_tier = 'pro', plan_ends_at = $1, plan_chosen = true
       WHERE id = $2`,
      [planEndsAt, session.user.id]
    );

    return NextResponse.json({ tx_ref: txRef, demo: true });
  } catch (error) {
    logError("Demo upgrade failed", error, "demo upgrade");
    return NextResponse.json(
      { error: "Demo upgrade failed" },
      { status: 500 }
    );
  }
}
