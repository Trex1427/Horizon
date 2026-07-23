import test from "node:test";
import assert from "node:assert/strict";
import {
  getLegacyTransactionType,
  isLegacyTransferLikeType,
  normalizeTransactionRecord,
  normalizeTransactionType,
} from "./transactionTypeUtils.js";

test("normalizeTransactionType accepts depense and revenu families only", () => {
  assert.equal(normalizeTransactionType("depense"), "depense");
  assert.equal(normalizeTransactionType("expense"), "depense");
  assert.equal(normalizeTransactionType("revenu"), "revenu");
  assert.equal(normalizeTransactionType("income"), "revenu");
  assert.equal(normalizeTransactionType("recette"), "revenu");
});

test("normalizeTransactionType does not coerce virement-like legacy values", () => {
  assert.equal(normalizeTransactionType("virement"), null);
  assert.equal(normalizeTransactionType("transfer"), null);
  assert.equal(normalizeTransactionType("transfert"), null);
  assert.equal(isLegacyTransferLikeType("virement"), true);
});

test("normalizeTransactionRecord preserves legacy type for review", () => {
  const legacy = normalizeTransactionRecord({ id: "t-legacy", type: "virement", montant: 50 });

  assert.equal(legacy.type, "virement");
  assert.equal(legacy.normalizedType, null);
  assert.equal(legacy.legacyType, "virement");
  assert.equal(legacy.needsTypeReview, true);
  assert.equal(getLegacyTransactionType(legacy.type), "virement");
});

test("normalizeTransactionRecord keeps optional reference ids and names nullable", () => {
  const normalized = normalizeTransactionRecord({
    id: "t-1",
    type: "depense",
    montant: 20,
    subcategoryId: "sub-1",
    subcategoryName: "Carburant",
    activityId: "act-1",
    activityName: "Auto-entreprise",
    thirdPartyId: "tp-1",
    thirdPartyName: "EDF",
    projectId: "proj-1",
    projectName: "Chantier Monod",
  });

  assert.equal(normalized.subcategoryId, "sub-1");
  assert.equal(normalized.subcategoryName, "Carburant");
  assert.equal(normalized.activityId, "act-1");
  assert.equal(normalized.thirdPartyId, "tp-1");
  assert.equal(normalized.projectId, "proj-1");
});

test("adjustment transactions are explicit but not income, expense or legacy", () => {
  const adjustment = normalizeTransactionRecord({ id: "adj", type: "adjustment", montant: 15 });

  assert.equal(normalizeTransactionType("adjustment"), null);
  assert.equal(adjustment.isAdjustment, true);
  assert.equal(adjustment.needsTypeReview, false);
  assert.equal(isLegacyTransferLikeType("adjustment"), false);
});
