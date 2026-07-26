import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCashAdjustmentId,
  buildCashAdjustmentPayload,
  calculateCashAdjustmentDelta,
  hasCashAccountHistory,
  parseCashAmount,
} from "./cashBalanceAdjustment.js";
import { CASH_ADJUSTMENT_KINDS } from "../constants/cashBalanceConstants.js";

const fixedNow = new Date("2026-07-14T12:00:00Z");

test("parseCashAmount accepts comma and point decimal values", () => {
  assert.equal(parseCashAmount("87,35"), 87.35);
  assert.equal(parseCashAmount("87.35"), 87.35);
  assert.equal(parseCashAmount(" 1 087,35 "), 1087.35);
});

test("parseCashAmount rejects invalid values", () => {
  assert.equal(parseCashAmount(""), null);
  assert.equal(parseCashAmount("abc"), null);
  assert.equal(parseCashAmount(Number.POSITIVE_INFINITY), null);
});

test("calculateCashAdjustmentDelta computes positive, negative and zero differences", () => {
  assert.equal(calculateCashAdjustmentDelta(72.35, "87,35"), 15);
  assert.equal(calculateCashAdjustmentDelta(87.35, "80"), -7.35);
  assert.equal(calculateCashAdjustmentDelta(80, "80,00"), 0);
});

test("buildCashAdjustmentPayload creates an opening adjustment without mutating initial balance", () => {
  const payload = buildCashAdjustmentPayload({
    accountId: "cash",
    currentBalance: 0,
    targetBalance: "87,35",
    date: "2026-07-14",
    reason: "Comptage initial",
    kind: CASH_ADJUSTMENT_KINDS.opening,
    now: fixedNow,
  });

  assert.equal(payload.type, "adjustment");
  assert.equal(payload.adjustmentKind, "opening");
  assert.equal(payload.montant, 87.35);
  assert.equal(payload.targetBalance, 87.35);
  assert.equal(payload.description, "Ajustement de solde Espèces");
  assert.equal(payload.createdAt, fixedNow);
});

test("buildCashAdjustmentPayload creates signed balance adjustments", () => {
  const positive = buildCashAdjustmentPayload({
    accountId: "cash",
    currentBalance: 72.35,
    targetBalance: 87.35,
    date: "2026-07-14",
    now: fixedNow,
  });
  const negative = buildCashAdjustmentPayload({
    accountId: "cash",
    currentBalance: 87.35,
    targetBalance: 80,
    date: "2026-07-14",
    now: fixedNow,
  });

  assert.equal(positive.montant, 15);
  assert.equal(negative.montant, -7.35);
});

test("buildCashAdjustmentPayload refuses zero difference and missing account", () => {
  assert.throws(() => buildCashAdjustmentPayload({
    accountId: "cash",
    currentBalance: 80,
    targetBalance: 80,
  }), /correspond/);

  assert.throws(() => buildCashAdjustmentPayload({
    accountId: "",
    currentBalance: 0,
    targetBalance: 1,
  }), /introuvable/);
});

test("hasCashAccountHistory detects transactions and transfers on the cash account", () => {
  assert.equal(hasCashAccountHistory("cash", [], []), false);
  assert.equal(hasCashAccountHistory("cash", [{ accountId: "cash", montant: 1 }], []), true);
  assert.equal(hasCashAccountHistory("cash", [{ accountId: "cash", isDeleted: true }], []), false);
  assert.equal(hasCashAccountHistory("cash", [], [{ sourceAccountId: "cash", destinationAccountId: "bank", amount: 5 }]), true);
});

test("buildCashAdjustmentId is stable for duplicate-submit protection", () => {
  const left = buildCashAdjustmentId({
    accountId: "cash",
    date: "2026-07-14",
    targetBalance: "87,35",
    kind: CASH_ADJUSTMENT_KINDS.balance,
  });
  const right = buildCashAdjustmentId({
    accountId: "cash",
    date: "2026-07-14",
    targetBalance: 87.35,
    kind: CASH_ADJUSTMENT_KINDS.balance,
  });

  assert.equal(left, right);
});

test("buildCashAdjustmentId is isolated by ownerUid", () => {
  const base = {
    accountId: "default-cash",
    date: "2026-07-23",
    targetBalance: 120,
    kind: "balance",
  };

  assert.notEqual(
    buildCashAdjustmentId({ ...base, ownerUid: "owner-a" }),
    buildCashAdjustmentId({ ...base, ownerUid: "owner-b" })
  );
});
