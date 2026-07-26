import test from "node:test";
import assert from "node:assert/strict";
import { parsePaymentAmountInput } from "./paymentInput.js";

test("payment amount accepts 400 with point or French comma", () => {
  assert.equal(parsePaymentAmountInput("400"), 400);
  assert.equal(parsePaymentAmountInput("400.00"), 400);
  assert.equal(parsePaymentAmountInput("400,00"), 400);
  assert.equal(parsePaymentAmountInput("1 234,56"), 1234.56);
});

test("payment amount rejects invalid, negative and over-precision input", () => {
  assert.equal(Number.isNaN(parsePaymentAmountInput("400,001")), true);
  assert.equal(Number.isNaN(parsePaymentAmountInput("-400")), true);
  assert.equal(Number.isNaN(parsePaymentAmountInput("")), true);
});