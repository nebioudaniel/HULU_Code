import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

import {
  detectKeyKind,
  getKeyKind,
  getWebhookSignatureHeader,
  mapV2ErrorCode,
  modeMatchesKeyKind,
  verifyWebhookSignature,
  buildV2InitializeBody,
} from "./chapa.ts";

function envWith(key: string | undefined): { restore: () => void } {
  const prev = process.env.CHAPA_SECRET_KEY;
  const prevWebhook = process.env.CHAPA_WEBHOOK_SECRET;
  process.env.CHAPA_SECRET_KEY = key ?? "";
  process.env.CHAPA_WEBHOOK_SECRET = "";
  return {
    restore: () => {
      process.env.CHAPA_SECRET_KEY = prev ?? "";
      process.env.CHAPA_WEBHOOK_SECRET = prevWebhook ?? "";
    },
  };
}

test("detectKeyKind identifies v2 test key", () => {
  assert.equal(detectKeyKind("CHAPA_TEST_sk_live_abc123"), "v2test");
});

test("detectKeyKind identifies v2 live key", () => {
  assert.equal(detectKeyKind("CHAPA_LIVE_sk_live_abc123"), "v2live");
});

test("detectKeyKind identifies v1 test key", () => {
  assert.equal(detectKeyKind("CHASECK_TEST_abc123"), "v1test");
});

test("detectKeyKind identifies v1 live key", () => {
  assert.equal(detectKeyKind("CHASECK_LIVE_abc123"), "v1live");
});

test("detectKeyKind identifies public key", () => {
  assert.equal(detectKeyKind("CHAPUBK_pk_test_abc123"), "public");
});

test("detectKeyKind identifies unknown key", () => {
  assert.equal(detectKeyKind("sk_test_abc123"), "unknown");
});

test("detectKeyKind identifies CHASECK_TEST prefix as v1test", () => {
  assert.equal(detectKeyKind("CHASECK_TEST-x"), "v1test");
});

test("detectKeyKind identifies CHASECK prefix as v1", () => {
  assert.equal(detectKeyKind("CHASECK-x"), "v1");
});

test("detectKeyKind identifies CHAPA_TEST_x as v2test", () => {
  assert.equal(detectKeyKind("CHAPA_TEST_x"), "v2test");
});

test("detectKeyKind identifies CHAPA_LIVE_x as v2live", () => {
  assert.equal(detectKeyKind("CHAPA_LIVE_x"), "v2live");
});

test("detectKeyKind identifies CHAPUBK_TEST as public", () => {
  assert.equal(detectKeyKind("CHAPUBK_TEST-x"), "public");
});

test("detectKeyKind identifies empty string as unknown", () => {
  assert.equal(detectKeyKind(""), "unknown");
});

test("getKeyKind reads from CHAPA_SECRET_KEY", () => {
  const restore = envWith("CHAPA_TEST_sk_live_abc");
  try {
    assert.equal(getKeyKind(), "v2test");
  } finally {
    restore.restore();
  }
});

test("getKeyKind returns undefined when no key", () => {
  const restore = envWith(undefined);
  try {
    assert.equal(getKeyKind(), undefined);
  } finally {
    restore.restore();
  }
});

test("buildV2InitializeBody builds correct body", () => {
  const body = buildV2InitializeBody({
    amount: 59.9,
    currency: "ETB",
    merchantReference: "tx_abc123",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phoneNumber: "+251912345678",
    userId: "user_1",
  });

  assert.equal(body.amount, 59.9);
  assert.equal(body.currency, "ETB");
  assert.equal(body.merchant_reference, "tx_abc123");

  const customer = body.customer as Record<string, unknown>;
  assert.equal(customer.first_name, "Ada");
  assert.equal(customer.last_name, "Lovelace");
  assert.equal(customer.email, "ada@example.com");
  assert.equal(customer.phone_number, "+251912345678");

  const meta = body.meta as Record<string, unknown>;
  assert.equal(meta.user_id, "user_1");
  assert.equal(meta.plan, "pro");

  assert.equal(Object.keys(body).sort().join(","), [
    "amount",
    "currency",
    "customer",
    "merchant_reference",
    "meta",
  ].sort().join(","));
});

test("buildV2InitializeBody omits phone_number when invalid", () => {
  const body = buildV2InitializeBody({
    amount: 59.9,
    currency: "ETB",
    merchantReference: "tx_abc123",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phoneNumber: "0912345678",
    userId: "user_1",
  });

  const customer = body.customer as Record<string, unknown>;
  assert.equal(customer.phone_number, undefined);
});

test("buildV2InitializeBody omits phone_number when not +251", () => {
  const body = buildV2InitializeBody({
    amount: 59.9,
    currency: "ETB",
    merchantReference: "tx_abc123",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@example.com",
    phoneNumber: "+14155552671",
    userId: "user_1",
  });

  const customer = body.customer as Record<string, unknown>;
  assert.equal(customer.phone_number, undefined);
});

test("mapV2ErrorCode maps INVALID_VALUE email error", () => {
  assert.equal(
    mapV2ErrorCode("INVALID_VALUE", "email is invalid"),
    "Please check your email address and try again."
  );
});

test("mapV2ErrorCode maps environment mismatch", () => {
  assert.equal(
    mapV2ErrorCode("ENVIRONMENT_MISMATCH", "live key used in test"),
    "Payments are not configured correctly."
  );
});

test("mapV2ErrorCode returns generic message for unknown code", () => {
  assert.equal(
    mapV2ErrorCode("UNKNOWN_CODE", "something broke"),
    "Payment could not be started. Please try again later."
  );
});

test("mapV2ErrorCode returns generic message for missing code", () => {
  assert.equal(
    mapV2ErrorCode(undefined, "no code"),
    "Payment could not be started. Please try again later."
  );
});

test("verifyWebhookSignature verifies known vector", () => {
  const secret = "whsec_test_secret";
  const body = JSON.stringify({ event: "payment.success", status: "success" });
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");

  const restore = envWith("CHAPA_TEST_sk_live_abc");
  process.env.CHAPA_WEBHOOK_SECRET = secret;
  try {
    assert.equal(verifyWebhookSignature(body, expected, "v2test"), true);
    assert.equal(verifyWebhookSignature(body, "bad signature", "v2test"), false);
    assert.equal(verifyWebhookSignature(body, null, "v2test"), false);
  } finally {
    restore.restore();
  }
});

test("verifyWebhookSignature accepts missing secret in non-production", () => {
  const restore = envWith("CHAPA_TEST_sk_live_abc");
  process.env.CHAPA_WEBHOOK_SECRET = "";
  try {
    assert.equal(verifyWebhookSignature("body", "sig", "v2test"), true);
  } finally {
    restore.restore();
  }
});

test("modeMatchesKeyKind ignores missing mode", () => {
  assert.equal(modeMatchesKeyKind(undefined, "v2test"), true);
});

test("modeMatchesKeyKind matches test mode with test key", () => {
  assert.equal(modeMatchesKeyKind("test", "v2test"), true);
  assert.equal(modeMatchesKeyKind("test", "v1test"), true);
});

test("modeMatchesKeyKind matches live mode with live key", () => {
  assert.equal(modeMatchesKeyKind("live", "v2live"), true);
  assert.equal(modeMatchesKeyKind("live", "v1live"), true);
});

test("modeMatchesKeyKind rejects mismatched mode", () => {
  assert.equal(modeMatchesKeyKind("test", "v2live"), false);
  assert.equal(modeMatchesKeyKind("live", "v1test"), false);
});

test("modeMatchesKeyKind matches v1 key in any mode", () => {
  assert.equal(modeMatchesKeyKind("test", "v1"), true);
  assert.equal(modeMatchesKeyKind("live", "v1"), true);
});

test("getWebhookSignatureHeader prefers x-chapa-signature for v2", () => {
  const req = {
    headers: {
      get: (name: string) =>
        name === "x-chapa-signature" ? "v2sig" : null,
    },
  };
  assert.equal(getWebhookSignatureHeader(req, "v2test"), "v2sig");
});

test("getWebhookSignatureHeader accepts chapa-signature for v1", () => {
  const req = {
    headers: {
      get: (name: string) =>
        name === "chapa-signature" ? "v1sig" : null,
    },
  };
  assert.equal(getWebhookSignatureHeader(req, "v1test"), "v1sig");
});

test("getWebhookSignatureHeader accepts chapa-signature for v1 key kind", () => {
  const req = {
    headers: {
      get: (name: string) =>
        name === "chapa-signature" ? "v1sig" : null,
    },
  };
  assert.equal(getWebhookSignatureHeader(req, "v1"), "v1sig");
});
