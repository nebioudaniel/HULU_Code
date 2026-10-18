import { Pool } from "pg";

export function createPgPool(connectionString: string | undefined): Pool {
  return new Pool({ connectionString });
}
