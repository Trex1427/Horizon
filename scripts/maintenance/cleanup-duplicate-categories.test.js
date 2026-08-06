import test from "node:test";
import assert from "node:assert/strict";
import { buildDuplicatePlan, buildReferencePatch } from "./cleanup-duplicate-categories.mjs";

const OWNER_UID = "owner-user-123";
const OTHER_OWNER_UID = "owner-user-456";

test("duplicate cleanup keeps the non-reset keeper for each owner", () => {
  const plan = buildDuplicatePlan([
    { id: "transport-canonical", ownerUid: OWNER_UID, name: "Transport", type: "depense", createdAt: { seconds: 1, nanoseconds: 0 } },
    { id: "reset-owner-user-123-transport", ownerUid: OWNER_UID, name: "Transport", type: "depense", createdAt: { seconds: 2, nanoseconds: 0 } },
    { id: "transport-other-owner", ownerUid: OTHER_OWNER_UID, name: "Transport", type: "depense", createdAt: { seconds: 3, nanoseconds: 0 } },
  ]);

  assert.equal(plan.duplicateGroups.length, 1);
  assert.equal(plan.duplicateGroups[0].keeper.id, "transport-canonical");
  assert.deepEqual(plan.toDelete.map((category) => category.id), ["reset-owner-user-123-transport"]);
  assert.equal(plan.remapByCategoryId.get("reset-owner-user-123-transport").keeperId, "transport-canonical");
});

test("reference patch remaps category fields before deletion", () => {
  const patch = buildReferencePatch(
    { categoryId: "reset-owner-user-123-transport", categoryName: "Transport", categorie: "Transport" },
    { keeperId: "transport-canonical", keeperName: "Transport" }
  );

  assert.deepEqual(patch, {
    categoryId: "transport-canonical",
    categoryName: "Transport",
    categorie: "Transport",
  });
});
