import { pool } from "@/lib/db";
import { logError } from "@/lib/errors";
import { getPlanLimits } from "@/lib/plans";

import { generateApiKey, hashApiKey } from "./api-key-hash";

export { generateApiKey, hashApiKey };

const DISPLAY_PREFIX_LENGTH = 12;

export type ApiKeyStatus = "Active" | "Revoked";

export type ApiKeyRecord = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  status: ApiKeyStatus;
};

export type CreateApiKeyResult =
  | { ok: true; key: string; record: ApiKeyRecord }
  | { ok: false; error: string; status: number };

export async function countActiveApiKeys(userId: string): Promise<number> {
  try {
    const result = await pool.query(
      "SELECT COUNT(*)::int AS count FROM api_keys WHERE user_id = $1 AND revoked_at IS NULL",
      [userId]
    );
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    logError("Could not count API keys", error, "count api keys");
    return 0;
  }
}

export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, key_prefix, created_at, last_used_at, revoked_at
         FROM api_keys
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC`,
      [userId]
    );

    return rows.map((row) => ({
      id: row.id,
      name: row.name ?? "",
      keyPrefix: row.key_prefix ?? "",
      createdAt: row.created_at ?? null,
      lastUsedAt: row.last_used_at ?? null,
      status: row.revoked_at ? "Revoked" : "Active",
    }));
  } catch (error) {
    logError("Could not list API keys", error, "list api keys");
    return [];
  }
}

export async function createApiKey(
  userId: string,
  rawName: string,
  planTier: string | null | undefined
): Promise<CreateApiKeyResult> {
  const name = rawName.trim();

  if (name.length < 1 || name.length > 40) {
    return {
      ok: false,
      error: "Name must be between 1 and 40 characters.",
      status: 400,
    };
  }

  const limit = getPlanLimits(planTier).apiKeys;
  const active = await countActiveApiKeys(userId);

  if (active >= limit) {
    return {
      ok: false,
      error: `Your plan allows ${limit} active ${limit === 1 ? "key" : "keys"}. Revoke a key or upgrade to create another.`,
      status: 403,
    };
  }

  const key = generateApiKey();
  const keyPrefix = key.slice(0, DISPLAY_PREFIX_LENGTH);
  const keyHash = hashApiKey(key);

  try {
    const { rows } = await pool.query(
      `INSERT INTO api_keys (user_id, name, key_prefix, key_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [userId, name, keyPrefix, keyHash]
    );

    const row = rows[0];

    return {
      ok: true,
      key,
      record: {
        id: row.id,
        name,
        keyPrefix,
        createdAt: row.created_at ?? null,
        lastUsedAt: null,
        status: "Active",
      },
    };
  } catch (error) {
    logError("Could not create API key", error, "create api key");
    return {
      ok: false,
      error: "Could not save the key. Please try again.",
      status: 500,
    };
  }
}

export type ApiKeyVerification =
  | { ok: true; keyId: string; userId: string; planTier: string }
  | { ok: false; status: number; error: string };

export async function verifyApiKey(rawKey: string): Promise<ApiKeyVerification> {
  const keyHash = hashApiKey(rawKey);

  try {
    const { rows } = await pool.query(
      `SELECT k.id, k.user_id, k.revoked_at, u.plan_tier
         FROM api_keys k
         JOIN users u ON k.user_id = u.id
        WHERE k.key_hash = $1`,
      [keyHash]
    );

    const row = rows[0];

    if (!row) {
      return { ok: false, status: 401, error: "Invalid API key" };
    }

    if (row.revoked_at) {
      return { ok: false, status: 401, error: "API key has been revoked" };
    }

    try {
      await pool.query(
        "UPDATE api_keys SET last_used_at = now() WHERE key_hash = $1",
        [keyHash]
      );
    } catch (error) {
      logError(
        "Could not update last_used_at",
        error,
        "update api key last used"
      );
    }

    return {
      ok: true,
      keyId: row.id,
      userId: row.user_id,
      planTier: row.plan_tier,
    };
  } catch (error) {
    logError("Could not verify API key", error, "verify api key");
    return { ok: false, status: 500, error: "Database error" };
  }
}

export async function revokeApiKey(
  userId: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { rows } = await pool.query(
      `UPDATE api_keys
          SET revoked_at = now()
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id`,
      [id, userId]
    );

    if (rows.length === 0) {
      return { ok: false, error: "That key was not found." };
    }

    return { ok: true };
  } catch (error) {
    logError("Could not revoke API key", error, "revoke api key");
    return { ok: false, error: "Could not revoke the key." };
  }
}
