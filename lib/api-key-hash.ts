import { createHash, randomBytes } from "node:crypto";

const KEY_BODY_BYTES = 32;

export function generateApiKey(): string {
  return `hulu_sk_${randomBytes(KEY_BODY_BYTES).toString("base64url")}`;
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}
