import test from "node:test";
import assert from "node:assert/strict";
import { getMockBulkClassificationSuggestion } from "./bulkClassificationSuggestionMock.js";

test("getMockBulkClassificationSuggestion returns the hardcoded UX suggestion and resolves category id when available", () => {
  const suggestion = getMockBulkClassificationSuggestion([
    { id: "cat-food", name: "Alimentation", isActive: true },
    { id: "cat-home", name: "Logement", isActive: true },
  ]);

  assert.deepEqual(suggestion, {
    sourceLabel: "CARREFOUR VITROLLES",
    categoryName: "Alimentation",
    categoryId: "cat-food",
  });
});

test("getMockBulkClassificationSuggestion keeps the UX suggestion even when the category is unavailable", () => {
  const suggestion = getMockBulkClassificationSuggestion([]);

  assert.deepEqual(suggestion, {
    sourceLabel: "CARREFOUR VITROLLES",
    categoryName: "Alimentation",
    categoryId: "",
  });
});