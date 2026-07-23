import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBulkTransactionPatch,
  resolveBulkTransactionPatchForTransaction,
  splitTransactionIdsIntoBatches,
  summarizeBulkTransactionPatch,
} from "./transactionBulkUpdateCore.js";

test("buildBulkTransactionPatch keeps only whitelisted fields", () => {
  const patch = buildBulkTransactionPatch({
    categoryId: "cat-home",
    subcategoryId: "",
    activityId: "act-1",
    thirdPartyId: null,
    projectId: "proj-1",
    accountId: "acc-1",
    type: "revenu",
    montant: 123,
    description: "ignored",
  });

  assert.deepEqual(patch, {
    categoryId: "cat-home",
    subcategoryId: null,
    activityId: "act-1",
    thirdPartyId: null,
    projectId: "proj-1",
    accountId: "acc-1",
    type: "revenu",
  });
});

test("buildBulkTransactionPatch can produce a category-only classification patch", () => {
  const sourcePatch = {
    categoryId: "cat-home",
  };

  const normalizedPatch = buildBulkTransactionPatch(sourcePatch);

  assert.deepEqual(normalizedPatch, {
    categoryId: "cat-home",
  });
  assert.deepEqual(sourcePatch, {
    categoryId: "cat-home",
  });
});

test("buildBulkTransactionPatch keeps explicit empty categoryId for uncategorized classification", () => {
  const sourcePatch = {
    categoryId: "",
  };

  const normalizedPatch = buildBulkTransactionPatch(sourcePatch);

  assert.deepEqual(normalizedPatch, {
    categoryId: "",
  });
  assert.deepEqual(sourcePatch, {
    categoryId: "",
  });
});

test("splitTransactionIdsIntoBatches chunks safely above 500", () => {
  const ids = Array.from({ length: 503 }, (_, index) => `tx-${index + 1}`);
  const batches = splitTransactionIdsIntoBatches(ids, 450);

  assert.equal(batches.length, 2);
  assert.equal(batches[0].length, 450);
  assert.equal(batches[1].length, 53);
});

test("splitTransactionIdsIntoBatches does not mutate source ids", () => {
  const ids = ["tx-1", "tx-2", "tx-3"];
  const copy = [...ids];

  splitTransactionIdsIntoBatches(ids, 2);

  assert.deepEqual(ids, copy);
});

test("resolveBulkTransactionPatchForTransaction clears incompatible subcategory when requested", () => {
  const catalogs = {
    categoryMap: new Map([[
      "cat-home",
      { id: "cat-home", name: "Logement", type: "depense", isActive: true },
    ]]),
    subcategoryMap: new Map([[
      "sub-food",
      { id: "sub-food", name: "Courses", categoryId: "cat-food", isActive: true },
    ]]),
    accountMap: new Map(),
    activityMap: new Map(),
    thirdPartyMap: new Map(),
    projectMap: new Map(),
  };

  const result = resolveBulkTransactionPatchForTransaction(
    {
      id: "tx-1",
      categoryId: "cat-food",
      subcategoryId: "sub-food",
    },
    {
      categoryId: "cat-home",
    },
    catalogs,
    { clearIncompatibleSubcategories: true }
  );

  assert.equal(result.ok, true);
  assert.equal(result.patch.categoryId, "cat-home");
  assert.equal(result.patch.subcategoryId, null);
});

test("resolveBulkTransactionPatchForTransaction rejects incompatible subcategory when not allowed", () => {
  const catalogs = {
    categoryMap: new Map([[
      "cat-home",
      { id: "cat-home", name: "Logement", type: "depense", isActive: true },
    ]]),
    subcategoryMap: new Map([[
      "sub-food",
      { id: "sub-food", name: "Courses", categoryId: "cat-food", isActive: true },
    ]]),
    accountMap: new Map(),
    activityMap: new Map(),
    thirdPartyMap: new Map(),
    projectMap: new Map(),
  };

  const result = resolveBulkTransactionPatchForTransaction(
    {
      id: "tx-1",
      categoryId: "cat-food",
      subcategoryId: "sub-food",
    },
    {
      categoryId: "cat-home",
    },
    catalogs,
    { clearIncompatibleSubcategories: false }
  );

  assert.equal(result.ok, false);
  assert.match(result.error, /incompatible/i);
});

test("summarizeBulkTransactionPatch renders selected fields", () => {
  const summary = summarizeBulkTransactionPatch(
    {
      categoryId: "cat-home",
      categoryName: "Logement",
      subcategoryId: "sub-electricity",
      subcategoryName: "Electricite",
      thirdPartyId: null,
    },
    6
  );

  assert.equal(summary.title, "6 transactions seront modifiees");
  assert.equal(summary.lines[0], "Categorie : Logement");
  assert.equal(summary.lines[1], "Sous-categorie : Electricite");
});
