import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SEED_SOURCE,
  buildCleanupPlanByCollection,
  classifyDemoTransactionsByFingerprint,
  countNonSeededTransactions,
  planRequiredCategories,
  planSubcategorySeed,
} from "./reference-seed-lib.mjs";

test("cleanup removes only demo-seeded transactions", () => {
  const plan = buildCleanupPlanByCollection({
    transactions: [
      { id: "tx-demo-1", seedSource: DEMO_SEED_SOURCE },
      { id: "tx-real-1", seedSource: "manual" },
      { id: "tx-real-2" },
    ],
  }, DEMO_SEED_SOURCE);

  assert.deepEqual(plan.transactions.seededIds, ["tx-demo-1"]);
  assert.equal(plan.transactions.deleteCount, 1);
});

test("cleanup keeps real transactions untouched", () => {
  const transactions = [
    { id: "tx-demo", seedSource: DEMO_SEED_SOURCE },
    { id: "tx-real-a", seedSource: "bank-import" },
    { id: "tx-real-b" },
  ];

  assert.equal(countNonSeededTransactions(transactions, DEMO_SEED_SOURCE), 2);
});

test("demo seed is idempotent by stable seed fingerprint", () => {
  const existing = [{ id: "tx-1", seedFingerprint: "demo-fp-1" }];
  const candidates = [
    { seedFingerprint: "demo-fp-1" },
    { seedFingerprint: "demo-fp-2" },
    { seedFingerprint: "demo-fp-2" },
  ];

  const result = classifyDemoTransactionsByFingerprint(candidates, existing);

  assert.equal(result.created.length, 1);
  assert.equal(result.alreadyExisting.length, 2);
  assert.equal(result.created[0].seedFingerprint, "demo-fp-2");
});

test("missing parent categories are detected as creatable", () => {
  const result = planRequiredCategories([
    { id: "cat-transport", name: "Transport", type: "depense" },
  ]);

  assert.equal(result.toCreate.length, 2);
  assert.equal(result.alreadyExisting.length, 0);
});

test("subcategories can be planned after parent categories exist", () => {
  const mapping = {
    "Aides et prestations": ["CAF", "CPAM"],
  };

  const before = planSubcategorySeed({
    categories: [],
    existingSubcategories: [],
    subcategoriesByParent: mapping,
  });
  assert.equal(before.toCreate.length, 0);
  assert.equal(before.missingParents.length, 1);

  const after = planSubcategorySeed({
    categories: [{ id: "cat-aides", name: "Aides et prestations", type: "revenu" }],
    existingSubcategories: [],
    subcategoriesByParent: mapping,
  });
  assert.equal(after.missingParents.length, 0);
  assert.equal(after.toCreate.length, 2);
});
