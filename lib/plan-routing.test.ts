import assert from "node:assert/strict";
import { test } from "node:test";

import {
  paymentDestination,
  planErrorMessage,
  redirectFor,
} from "./plan-routing.ts";

const anonymous = { authenticated: false, planChosen: false };
const newUser = { authenticated: true, planChosen: false };
const returningUser = { authenticated: true, planChosen: true };

test("no session goes home from either gate", () => {
  assert.equal(redirectFor("dashboard", anonymous), "/");
  assert.equal(redirectFor("select-plan", anonymous), "/");
});

test("new user goes to select plan from dashboard", () => {
  assert.equal(redirectFor("dashboard", newUser), "/select-plan");
  assert.equal(redirectFor("select-plan", newUser), null);
});

test("returning user stays on dashboard", () => {
  assert.equal(redirectFor("dashboard", returningUser), null);
  assert.equal(redirectFor("select-plan", returningUser), "/dashboard");
});

test("free choice unlocks the dashboard", () => {
  assert.equal(redirectFor("dashboard", returningUser), null);
});

test("verified pro lands on dashboard", () => {
  assert.equal(paymentDestination("success"), "/dashboard");
});

test("failed pro returns to select plan", () => {
  assert.equal(
    paymentDestination("failed"),
    "/select-plan?error=payment_failed"
  );
  assert.equal(
    planErrorMessage("payment_failed"),
    "The payment failed or was cancelled. You have not been charged."
  );
});

test("pending and unknown payments return to select plan", () => {
  assert.equal(
    paymentDestination("pending"),
    "/select-plan?error=payment_pending"
  );
  assert.equal(
    paymentDestination("unknown"),
    "/select-plan?error=unknown_ref"
  );
});
