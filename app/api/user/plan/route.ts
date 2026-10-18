import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { pool } from "@/lib/db";
import { logError } from "@/lib/errors";

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let plan: unknown;
  try {
    ({ plan } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (plan !== "free") {
    return NextResponse.json({ error: "Unsupported plan" }, { status: 400 });
  }

  try {
    await pool.query(
      `UPDATE users
       SET plan_tier = $1, plan_ends_at = NULL, plan_chosen = true
       WHERE id = $2`,
      [plan, session.user.id]
    );

    return NextResponse.json({
      success: true,
      plan_tier: plan,
      plan_chosen: true,
    });
  } catch (error) {
    logError("Plan update failed", error, "save free plan");
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
