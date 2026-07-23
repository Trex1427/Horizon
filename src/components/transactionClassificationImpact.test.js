import test from "node:test";
import assert from "node:assert/strict";

import { buildClassificationImpactSummary } from "./transactionClassificationImpact.js";

const categories = [
  { id: "cat-food", name: "Alimentation", type: "depense" },
  { id: "cat-transport", name: "Transport", type: "depense" },
];

test("buildClassificationImpactSummary counts transactions already in selected category by categoryId", () => {
  const selectedTransactions = [
    { id: "t1", categoryId: "cat-food", categoryName: "Alimentation" },
    { id: "t2", categoryId: "cat-food", categoryName: "Alimentation" },
    { id: "t3", categoryId: "cat-transport", categoryName: "Transport" },
  ];

  const summary = buildClassificationImpactSummary({
    selectedTransactions,
    categories,
    selectedCategoryId: "cat-food",
    selectedCategoryLabel: "Alimentation",
  });

  assert.equal(summary.alreadyInTargetCount, 2);
  assert.equal(summary.willChangeCount, 1);
  assert.equal(summary.selectedCount, 3);
});

test("buildClassificationImpactSummary reports mixed selection counts accurately", () => {
  const selectedTransactions = [
    { id: "t1", categoryId: "cat-food" },
    { id: "t2", categoryId: "cat-transport" },
    { id: "t3", categoryId: "cat-food" },
    { id: "t4", categoryId: "cat-transport" },
  ];

  const summary = buildClassificationImpactSummary({
    selectedTransactions,
    categories,
    selectedCategoryId: "cat-transport",
    selectedCategoryLabel: "Transport",
  });

  assert.equal(summary.alreadyInTargetCount, 2);
  assert.equal(summary.willChangeCount, 2);
  assert.equal(summary.alreadyInTargetCount + summary.willChangeCount, summary.selectedCount);
});

test("buildClassificationImpactSummary supports legacy transactions without categoryId via compatible category name", () => {
  const selectedTransactions = [
    { id: "t1", categoryName: "Alimentation" },
    { id: "t2", categorie: "Transport" },
    { id: "t3", category: "Alimentation" },
  ];

  const summary = buildClassificationImpactSummary({
    selectedTransactions,
    categories,
    selectedCategoryId: "cat-food",
    selectedCategoryLabel: "Alimentation",
  });

  assert.equal(summary.alreadyInTargetCount, 2);
  assert.equal(summary.willChangeCount, 1);
});

test("buildClassificationImpactSummary keeps uncategorized behavior", () => {
  const selectedTransactions = [
    { id: "t1", categoryId: "" },
    { id: "t2", categoryName: "Sans catégorie" },
    { id: "t3", category: "Sans categorie" },
    { id: "t4", categoryId: "cat-food", categoryName: "Alimentation" },
  ];

  const summary = buildClassificationImpactSummary({
    selectedTransactions,
    categories,
    selectedCategoryId: "__UNCATEGORIZED__",
    selectedCategoryLabel: "Sans catégorie",
    uncategorizedValue: "__UNCATEGORIZED__",
  });

  assert.equal(summary.alreadyInTargetCount, 3);
  assert.equal(summary.willChangeCount, 1);
  assert.equal(summary.alreadyInTargetCount + summary.willChangeCount, summary.selectedCount);
});

test("buildClassificationImpactSummary does not mutate source transactions", () => {
  const selectedTransactions = [
    { id: "t1", categoryId: "cat-food", categoryName: "Alimentation" },
    { id: "t2", categoryName: "Transport" },
  ];
  const originalSnapshot = JSON.parse(JSON.stringify(selectedTransactions));

  buildClassificationImpactSummary({
    selectedTransactions,
    categories,
    selectedCategoryId: "cat-food",
    selectedCategoryLabel: "Alimentation",
  });

  assert.deepEqual(selectedTransactions, originalSnapshot);
});
