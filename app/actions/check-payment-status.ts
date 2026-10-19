"use server"

import { auth } from "@/auth"
import { pool } from "@/lib/db"
import { verifyAndFulfill } from "@/lib/chapa"

export async function checkPaymentStatus() {
  const session = await auth()
  if (!session?.user?.id) {
    return { error: "Unauthorized" }
  }

  const { rows } = await pool.query(
    "SELECT tx_ref FROM payments WHERE user_id = $1 AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
    [session.user.id]
  )

  if (rows.length === 0) {
    return { error: "No pending payment found" }
  }

  const result = await verifyAndFulfill(rows[0].tx_ref, {
    userId: session.user.id,
  })

  return { state: result.state }
}
