import { pool } from "@/lib/db";

let schemaReady: Promise<void> | null = null;

export function ensurePaymentsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = pool
      .query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS chapa_reference TEXT")
      .then(() =>
        pool.query(
          "ALTER TABLE payments ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'hosted'"
        )
      )
      .then(() => undefined)
      .catch((error) => {
        schemaReady = null;
        throw error;
      });
  }

  return schemaReady;
}
