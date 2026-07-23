import test from "node:test";
import assert from "node:assert/strict";

import { validateAndNormalizeExtraction } from "./receiptExtractionSchema.js";

const categoryCatalog = [
  { id: "cat-food", name: "Alimentation", type: "depense" },
  { id: "cat-salary", name: "Salaire", type: "revenu" },
];

function getBaseExtraction(overrides = {}) {
  return {
    type: "depense",
    amount: 87.45,
    date: "10/07/2026",
    merchant: " Leroy Merlin ",
    items: [
      {
        label: "TERREAU UNIVERSEL 40L",
        quantity: 2,
        unitAmount: 7.95,
        amount: 15.9,
      },
      {
        label: "",
        quantity: 1,
        unitAmount: 0,
        amount: 0,
      },
    ],
    keywords: ["Terreau", "terreau", "Paillage"],
    suggestedCategoryId: "cat-food",
    suggestedCategoryName: "Alimentation",
    categoryConfidence: 0.91,
    categoryReason: "Les principaux articles detectes concernent l'alimentaire.",
    merchantConfidence: 0.98,
    dateConfidence: 0.96,
    amountConfidence: 0.99,
    overallConfidence: 0.94,
    ...overrides,
  };
}

test("validateAndNormalizeExtraction keeps full item labels and resolves valid category id", () => {
  const extraction = validateAndNormalizeExtraction(getBaseExtraction(), categoryCatalog);

  assert.equal(extraction.date, "2026-07-10");
  assert.equal(extraction.merchant, "Leroy Merlin");
  assert.deepEqual(extraction.items, [
    {
      label: "TERREAU UNIVERSEL 40L",
      quantity: 2,
      unitAmount: 7.95,
      amount: 15.9,
    },
  ]);
  assert.deepEqual(extraction.keywords, ["terreau", "paillage"]);
  assert.equal(extraction.suggestedCategoryId, "cat-food");
  assert.equal(extraction.suggestedCategoryName, "Alimentation");
  assert.equal(extraction.suggestedCategory, "Alimentation");
});

test("validateAndNormalizeExtraction rejects invented category id but keeps textual suggestion", () => {
  const extraction = validateAndNormalizeExtraction(
    getBaseExtraction({
      suggestedCategoryId: "cat-invented",
      suggestedCategoryName: "Jardin",
    }),
    categoryCatalog
  );

  assert.equal(extraction.suggestedCategoryId, null);
  assert.equal(extraction.suggestedCategoryName, "Jardin");
  assert.equal(extraction.suggestedCategory, "Jardin");
});

test("validateAndNormalizeExtraction supports legacy suggestedCategory without id", () => {
  const extraction = validateAndNormalizeExtraction(
    getBaseExtraction({
      suggestedCategoryId: null,
      suggestedCategoryName: null,
      suggestedCategory: "Alimentation",
    }),
    []
  );

  assert.equal(extraction.suggestedCategoryId, null);
  assert.equal(extraction.suggestedCategoryName, "Alimentation");
  assert.equal(extraction.suggestedCategory, "Alimentation");
});

test("validateAndNormalizeExtraction normalizes out-of-range confidences to null", () => {
  const extraction = validateAndNormalizeExtraction(
    getBaseExtraction({
      merchantConfidence: 1.5,
      dateConfidence: -0.1,
      amountConfidence: "bad",
      categoryConfidence: 2,
      overallConfidence: -3,
    }),
    categoryCatalog
  );

  assert.equal(extraction.merchantConfidence, null);
  assert.equal(extraction.dateConfidence, null);
  assert.equal(extraction.amountConfidence, null);
  assert.equal(extraction.categoryConfidence, null);
  assert.equal(extraction.overallConfidence, null);
});