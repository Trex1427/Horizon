import test from "node:test";
import assert from "node:assert/strict";
import { buildLegacyReclassificationPayload } from "./legacyTransactionReview.js";

test("buildLegacyReclassificationPayload reclassifies legacy transaction to depense/revenu", () => {
  const payload = buildLegacyReclassificationPayload(
    {
      id: "legacy-1",
      type: "virement",
      montant: 120,
      date: "2026-07-11",
      accountId: "acc-1",
      description: "Legacy mouvement",
    },
    "revenu",
    {
      fallbackCategory: { id: "cat-income", name: "Autre revenu" },
      defaultAccountId: "acc-default",
    }
  );

  assert.equal(payload.type, "revenu");
  assert.equal(payload.categoryId, "cat-income");
  assert.equal(payload.accountId, "acc-1");
  assert.equal(payload.subcategoryId, null);
  assert.equal(payload.activityId, null);
  assert.equal(payload.thirdPartyId, null);
  assert.equal(payload.projectId, null);
});
