import test from "node:test";
import assert from "node:assert/strict";

import {
  applyReceiptCategorySuggestion,
  getReceiptCategorySuggestionState,
  normalizeReceiptDraft,
  RECEIPT_INTELLIGENCE_DEFAULTS,
} from "./receiptDraftIntelligence.js";

const availableCategories = [
  { id: "food", name: "Alimentation", type: "depense" },
  { id: "salary", name: "Salaire", type: "revenu" },
];

test("high confidence with valid category id preselects category", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      type: "depense",
      suggestedCategoryId: "food",
      suggestedCategoryName: "Alimentation",
      categoryConfidence: 0.91,
    },
    availableCategories
  );

  assert.equal(draft.categorie, "Alimentation");
  assert.equal(draft.categoryName, "Alimentation");
  assert.equal(draft.categoryId, "food");
  assert.equal(draft.receiptCategorySuggestionState, "high");
});

test("high confidence with invalid category id does not preselect", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      type: "depense",
      suggestedCategoryId: "invented-id",
      suggestedCategoryName: "Alimentation",
      categoryConfidence: 0.97,
    },
    availableCategories
  );

  assert.equal(draft.categorie || "", "");
  assert.equal(draft.categoryId || "", "");
  assert.equal(draft.receiptCategorySuggestionState, "unknown");
});

test("medium confidence keeps suggestion without preselection", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      type: "depense",
      suggestedCategoryId: "food",
      suggestedCategoryName: "Alimentation",
      categoryConfidence: 0.75,
    },
    availableCategories
  );

  assert.equal(draft.categorie || "", "");
  assert.equal(draft.categoryId || "", "");
  assert.equal(draft.receiptCategorySuggestionState, "medium");
  assert.equal(draft.matchedSuggestedCategoryName, "Alimentation");
});

test("low confidence does not preselect category", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      type: "depense",
      suggestedCategoryId: "food",
      suggestedCategoryName: "Alimentation",
      categoryConfidence: 0.42,
    },
    availableCategories
  );

  assert.equal(draft.categorie || "", "");
  assert.equal(draft.categoryId || "", "");
  assert.equal(draft.receiptCategorySuggestionState, "low");
});

test("legacy suggestedCategory without id remains compatible", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      date: "2026-07-10",
      montant: "18.50",
      categorie: "Alimentation",
      categoryName: "Alimentation",
      categoryId: "food",
      description: "Ticket Carrefour",
      type: "depense",
      accountId: "",
      destinationAccountId: "",
      suggestedCategory: "Alimentation",
    },
    availableCategories
  );

  assert.equal(draft.suggestedCategoryId, null);
  assert.equal(draft.suggestedCategoryName, "Alimentation");
  assert.equal(draft.suggestedCategory, "Alimentation");
  assert.deepEqual(draft.items, []);
  assert.deepEqual(draft.keywords, []);
  assert.equal(draft.merchantConfidence, null);
  assert.equal(draft.dateConfidence, null);
  assert.equal(draft.amountConfidence, null);
  assert.equal(draft.categoryConfidence, null);
  assert.equal(draft.overallConfidence, null);
});

test("normalizeReceiptDraft normalizes invalid confidence values to null", () => {
  const draft = normalizeReceiptDraft({
    ...RECEIPT_INTELLIGENCE_DEFAULTS,
    merchantConfidence: 1.1,
    dateConfidence: -0.2,
    amountConfidence: "bad",
    categoryConfidence: 9,
    overallConfidence: -1,
  });

  assert.equal(draft.merchantConfidence, null);
  assert.equal(draft.dateConfidence, null);
  assert.equal(draft.amountConfidence, null);
  assert.equal(draft.categoryConfidence, null);
  assert.equal(draft.overallConfidence, null);
});

test("normalizeReceiptDraft keeps full item labels and unit amount", () => {
  const draft = normalizeReceiptDraft({
    ...RECEIPT_INTELLIGENCE_DEFAULTS,
    items: [
      {
        label: "TERREAU UNIVERSEL 40L",
        quantity: 2,
        unitAmount: 7.95,
        amount: 15.9,
      },
    ],
  });

  assert.deepEqual(draft.items, [
    {
      label: "TERREAU UNIVERSEL 40L",
      quantity: 2,
      unitAmount: 7.95,
      amount: 15.9,
    },
  ]);
});

test("suggestion state is unknown when id is absent even with high confidence", () => {
  const draft = applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      type: "depense",
      suggestedCategoryId: null,
      suggestedCategoryName: "Alimentation",
      categoryConfidence: 0.99,
    },
    availableCategories
  );

  const state = getReceiptCategorySuggestionState(draft, availableCategories);
  assert.equal(state.level, "unknown");
  assert.equal(draft.categoryId || "", "");
});