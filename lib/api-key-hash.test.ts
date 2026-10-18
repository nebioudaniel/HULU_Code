import assert from "node:assert/strict";
import { test } from "node:test";

import { hashApiKey } from "./api-key-hash.ts";

const KNOWN_KEY = "hulu_sk_knownAnswerVector0000000000000";
const KNOWN_HASH =
  "bc51bf94c0e755747ec71bce5a74b3c2fbac2d5398b554e4ca3821b7e6251a1d";

test("hashApiKey matches the shared known-answer vector", () => {
  assert.equal(hashApiKey(KNOWN_KEY), KNOWN_HASH);
});
