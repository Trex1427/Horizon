import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTransferCreatePayload,
  buildTransferDeletePatch,
  buildTransferUpdatePayload,
} from "../utils/transferPersistence.js";

test("buildTransferCreatePayload validates and creates transfer payload", () => {
  const payload = buildTransferCreatePayload({
    date: "2026-07-11",
    amount: 300,
    sourceAccountId: "acc-1",
    destinationAccountId: "acc-2",
    description: "Epargne",
  });

  assert.equal(payload.amount, 300);
  assert.equal(payload.sourceAccountId, "acc-1");
  assert.equal(payload.destinationAccountId, "acc-2");
  assert.equal(payload.isActive, true);
  assert.equal(Boolean(payload.createdAt), true);
});

test("buildTransferUpdatePayload keeps transfer contract for edit", () => {
  const payload = buildTransferUpdatePayload({
    date: "2026-07-12",
    amount: 150,
    sourceAccountId: "acc-2",
    destinationAccountId: "acc-1",
    description: "Retour",
  });

  assert.equal(payload.amount, 150);
  assert.equal(payload.sourceAccountId, "acc-2");
  assert.equal(payload.destinationAccountId, "acc-1");
  assert.equal(Boolean(payload.updatedAt), true);
});

test("buildTransferDeletePatch creates soft-delete payload", () => {
  const patch = buildTransferDeletePatch();

  assert.equal(patch.isActive, false);
  assert.equal(Boolean(patch.deletedAt), true);
  assert.equal(Boolean(patch.updatedAt), true);
});
