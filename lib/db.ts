import { Pool } from '@neondatabase/serverless';

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}