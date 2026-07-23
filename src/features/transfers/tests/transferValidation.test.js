import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateTransferImpactByAccount,
  calculateTransfersNetImpact,
  normalizeTransferPayload,
  validateTransferPayload,
} from "../utils/transferValidation.js";

test("validateTransferPayload rejects identical source and destination accounts", () => {
  const error = validateTransferPayload({
    date: "2026-07-11",
    amount: 500,
    sourceAccountId: "acc-1",
    destinationAccountId: "acc-1",
  });

  assert.equal(error.includes("differents"), true);
});

test("validateTransferPayload rejects zero or negative amount", () => {
  const zeroError = validateTransferPayload({
    date: "2026-07-11",
    amount: 0,
    sourceAccountId: "acc-1",
    destinationAccountId: "acc-2",
  });

  const negativeError = validateTransferPayload({
    date: "2026-07-11",
    amount: -10,
    sourceAccountId: "acc-1",
    destinationAccountId: "acc-2",
  });

  assert.equal(zeroError.includes("superieur a 0"), true);
  assert.equal(negativeError.includes("superieur a 0"), true);
});

test("calculateTransferImpactByAccount debits source and credits destination", () => {
  const impact = calculateTransferImpactByAccount({
    date: "2026-07-11",
    amount: 500,
    sourceAccountId: "compte-courant",
    destinationAccountId: "livret-a",
  });

  assert.equal(impact["compte-courant"], -500);
  assert.equal(impact["livret-a"], 500);
});

test("calculateTransfersNetImpact remains zero for valid internal transfers", () => {
  const netImpact = calculateTransfersNetImpact([
    {
      date: "2026-07-11",
      amount: 500,
      sourceAccountId: "compte-courant",
      destinationAccountId: "livret-a",
    },
    {
      date: "2026-07-12",
      amount: 250,
      sourceAccountId: "livret-a",
      destinationAccountId: "compte-courant",
    },
  ]);

  assert.equal(netImpact, 0);
});

test("normalizeTransferPayload prepares canonical transfer object", () => {
  const transfer = normalizeTransferPayload({
    date: "2026-07-11",
    amount: "500",
    sourceAccountId: " compte-courant ",
    destinationAccountId: " livret-a ",
    description: " Epargne mensuelle ",
    notes: "  note  ",
  });

  assert.equal(transfer.amount, 500);
  assert.equal(transfer.sourceAccountId, "compte-courant");
  assert.equal(transfer.destinationAccountId, "livret-a");
  assert.equal(transfer.description, "Epargne mensuelle");
  assert.equal(transfer.notes, "note");
});
