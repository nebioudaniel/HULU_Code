import { Pool } from "@neondatabase/serverless";

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
const driver = process.env.DB_DRIVER === "pg" ? "pg" : "neon";

let backend: Promise<Pool> | null = null;

async function createPool(): Promise<Pool> {
  if (usesNeon(connectionString) || driver !== "pg") {
    return new Pool({ connectionString });
  }

  const { createPgPool } = await import("./db-pg");
  return createPgPool(connectionString) as unknown as Pool;
}

function getPool(): Promise<Pool> {
  if (!backend) {
    backend = createPool();
  }
  return backend;
}

export const pool = {
  query(text: string, params?: unknown[]) {
    return getPool().then((client) => client.query(text, params));
  },
  connect() {
    return getPool().then((client) => client.connect());
  },
} as unknown as Pool;

export async function query(text: string, params?: unknown[]) {
  const client = await pool.connect();
  try {
    return await client.query(text, params);
  } finally {
    client.release();
  }
}
