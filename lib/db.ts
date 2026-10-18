import { Pool } from "@neondatabase/serverless";
import { Pool as PostgresPool } from "pg";

function usesNeon(url: string | undefined): boolean {
  if (!url) {
    return false;
  }

  try {
    return new URL(url).hostname.endsWith("neon.tech");
  } catch {
    return false;
  }
}

const connectionString = process.env.DATABASE_URL;

export const pool = (
  usesNeon(connectionString)
    ? new Pool({ connectionString })
    : new PostgresPool({ connectionString })
) as unknown as Pool;

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
