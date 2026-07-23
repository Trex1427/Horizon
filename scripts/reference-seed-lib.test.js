import test from "node:test";
import assert from "node:assert/strict";
import {
  DEMO_SEED_SOURCE,
  REQUIRED_PARENT_CATEGORIES,
  SEED_SOURCE,
  buildCleanupPlanByCollection,
  buildNameIndex,
  buildSubcategoryIndex,
  classifyDemoTransactionsByFingerprint,
  classifySeedCandidatesByName,
  countNonSeededTransactions,
  normalizeName,
  planRequiredCategories,
  planSubcategorySeed,
  resolveActivityIdByName,
  resolveCategoryIdByName,
} from "./reference-seed-lib.mjs";

test("normalizeName lowercases, removes accents, and normalizes spaces", () => {
  assert.equal(normalizeName("  Électricité   Maison  "), "electricite maison");
  assert.equal(normalizeName("CAF"), "caf");
});

test("classifySeedCandidatesByName prevents duplicate creation in idempotent runs", () => {
  const existingIndex = buildNameIndex([
    { id: "a1", name: "Auto-entreprise" },
    { id: "a2", name: "Pêche" },
  ]);

  const result = classifySeedCandidatesByName([
    { name: "Auto-entreprise" },
    { name: "Pet sitting" },
    { name: "Pet   sitting" },
  ], existingIndex);

  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].name, "Pet sitting");
  assert.equal(result.alreadyExisting.length, 2);
});

test("resolveCategoryIdByName finds existing category with normalized lookup", () => {
  const categories = [
    { id: "cat-transport", name: "Transport", type: "depense" },
    { id: "cat-revenus", name: "Revenus professionnels", type: "revenu" },
  ];

  assert.equal(resolveCategoryIdByName(categories, "  revenus PROFESSIONNELS "), "cat-revenus");
  assert.equal(resolveCategoryIdByName(categories, "Inconnue"), null);
});

test("resolveActivityIdByName finds existing activity by normalized name", () => {
  const activities = [
    { id: "act-1", name: "Auto-entreprise" },
    { id: "act-2", name: "Pet sitting" },
  ];

  assert.equal(resolveActivityIdByName(activities, "  AUTO-entreprise "), "act-1");
  assert.equal(resolveActivityIdByName(activities, "Absente"), null);
});

test("buildSubcategoryIndex keeps independent keys per categoryId", () => {
  const index = buildSubcategoryIndex([
    { id: "s1", categoryId: "cat-transport", name: "Entretien" },
    { id: "s2", categoryId: "cat-logement", name: "Entretien" },
  ]);

  assert.equal(index.size, 2);
});

test("cleanup plan targets only seeded docs and preserves user docs", () => {
  const plan = buildCleanupPlanByCollection({
    activities: [
      { id: "act-seed", seedSource: SEED_SOURCE },
      { id: "act-user", seedSource: "manual" },
      { id: "act-user-2" },
    ],
  });

  assert.deepEqual(plan.activities.seededIds, ["act-seed"]);
  assert.equal(plan.activities.deleteCount, 1);
  assert.equal(plan.activities.nonSeededCount, 2);
});

test("planRequiredCategories creates missing parent categories only", () => {
  const result = planRequiredCategories([
    { id: "cat-existing", name: "Revenus professionnels", type: "revenu" },
  ]);

  assert.equal(result.alreadyExisting.length, 1);
  assert.equal(result.toCreate.length, 1);
  assert.equal(result.toCreate[0].name, "Aides et prestations");
  assert.equal(
    REQUIRED_PARENT_CATEGORIES.some((category) => category.name === result.toCreate[0].name),
    true
  );
});

test("planSubcategorySeed allows subcategory creation after missing parent is created", () => {
  const mapping = {
    "Revenus professionnels": ["Prestation"],
  };

  const beforeParent = planSubcategorySeed({
    categories: [{ id: "cat-transport", name: "Transport", type: "depense" }],
    existingSubcategories: [],
    subcategoriesByParent: mapping,
  });

  assert.equal(beforeParent.toCreate.length, 0);
  assert.equal(beforeParent.missingParents.length, 1);

  const afterParent = planSubcategorySeed({
    categories: [{ id: "cat-revenu", name: "Revenus professionnels", type: "revenu" }],
    existingSubcategories: [],
    subcategoriesByParent: mapping,
  });

  assert.equal(afterParent.missingParents.length, 0);
  assert.equal(afterParent.toCreate.length, 1);
  assert.equal(afterParent.toCreate[0].name, "Prestation");
  assert.equal(afterParent.toCreate[0].type, "revenu");
});

test("classifyDemoTransactionsByFingerprint is idempotent and prevents duplicate seed inserts", () => {
  const existing = [{ id: "t1", seedFingerprint: "demo-1", seedSource: DEMO_SEED_SOURCE }];
  const candidates = [
    { seedFingerprint: "demo-1" },
    { seedFingerprint: "demo-2" },
    { seedFingerprint: "demo-2" },
  ];

  const result = classifyDemoTransactionsByFingerprint(candidates, existing);

  assert.equal(result.created.length, 1);
  assert.equal(result.created[0].seedFingerprint, "demo-2");
  assert.equal(result.alreadyExisting.length, 2);
});

test("countNonSeededTransactions counts real transactions ignored by demo cleanup", () => {
  const transactions = [
    { id: "demo-1", seedSource: DEMO_SEED_SOURCE },
    { id: "real-1", seedSource: "manual" },
    { id: "real-2" },
  ];

  assert.equal(countNonSeededTransactions(transactions, DEMO_SEED_SOURCE), 2);
});
