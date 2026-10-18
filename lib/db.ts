import { Pool } from "@neondatabase/serverless";
import { getCloudflareContext } from "@opennextjs/cloudflare";

import { logError } from "@/lib/errors";

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

const driver = process.env.DB_DRIVER === "pg" ? "pg" : "neon";

let nodePool: Promise<Pool> | null = null;
const requestPools = new WeakMap<object, Promise<Pool>>();

function requestKey(): object | null {
  try {
    return getCloudflareContext().ctx;
  } catch {
    return null;
  }
}

async function createPool(): Promise<Pool> {
  const connectionString = process.env.DATABASE_URL;
  if (usesNeon(connectionString) || driver !== "pg") {
    return new Pool({ connectionString });
  }

  const { createPgPool } = await import("./db-pg");
  return createPgPool(connectionString) as unknown as Pool;
}

function getPool(): Promise<Pool> {
  const key = requestKey();

  if (!key) {
    nodePool ??= createPool();
    return nodePool;
  }

  let backend = requestPools.get(key);
  if (!backend) {
    backend = createPool();
    requestPools.set(key, backend);
  }
  return backend;
}

function run<T>(operation: string, task: (client: Pool) => Promise<T>): Promise<T> {
  return getPool()
    .then(task)
    .catch((error) => {
      logError("Database operation failed", error, operation);
      throw error;
    });
}

export const pool = {
  query(text: string, params?: unknown[]) {
    return run("query", (client) => client.query(text, params));
  },
  connect() {
    return run("connect", (client) => client.connect());
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
