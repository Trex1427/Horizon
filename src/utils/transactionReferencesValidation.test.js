import test from "node:test";
import assert from "node:assert/strict";
import {
  inferCategoryFromThirdParty,
  subcategoryBelongsToCategory,
  validateTransactionReferencesForSave,
} from "./transactionReferencesValidation.js";

test("subcategory belongs to expected category", () => {
  assert.equal(subcategoryBelongsToCategory({ id: "sub-1", categoryId: "cat-transport" }, "cat-transport"), true);
  assert.equal(subcategoryBelongsToCategory({ id: "sub-2", categoryId: "cat-loisirs" }, "cat-transport"), false);
});

test("third party alone does not force a category", () => {
  const inferred = inferCategoryFromThirdParty({ id: "tp-edf", name: "EDF", type: "supplier" });
  assert.equal(inferred, null);
});

test("validateTransactionReferencesForSave accepts optional empty references", () => {
  const message = validateTransactionReferencesForSave(
    {
      categoryId: "cat-transport",
      subcategoryId: null,
      activityId: null,
      thirdPartyId: null,
      projectId: null,
    },
    {
      subcategoryMap: new Map(),
      activityMap: new Map(),
      thirdPartyMap: new Map(),
      projectMap: new Map(),
    }
  );

  assert.equal(message, "");
});

test("validateTransactionReferencesForSave rejects subcategory mismatch", () => {
  const message = validateTransactionReferencesForSave(
    {
      categoryId: "cat-loisirs",
      subcategoryId: "sub-carburant",
    },
    {
      subcategoryMap: new Map([["sub-carburant", { id: "sub-carburant", categoryId: "cat-transport", isActive: true }]]),
      activityMap: new Map(),
      thirdPartyMap: new Map(),
      projectMap: new Map(),
    }
  );

  assert.equal(message.includes("incompatible"), true);
});

test("validateTransactionReferencesForSave rejects inactive references", () => {
  const message = validateTransactionReferencesForSave(
    {
      categoryId: "cat-transport",
      subcategoryId: "sub-carburant",
      activityId: "act-a",
      thirdPartyId: "tp-a",
      projectId: "proj-a",
    },
    {
      subcategoryMap: new Map([["sub-carburant", { id: "sub-carburant", categoryId: "cat-transport", isActive: false }]]),
      activityMap: new Map([["act-a", { id: "act-a", isActive: true }]]),
      thirdPartyMap: new Map([["tp-a", { id: "tp-a", isActive: true }]]),
      projectMap: new Map([["proj-a", { id: "proj-a", isActive: true }]]),
    }
  );

  assert.equal(message.includes("inactive"), true);
});
