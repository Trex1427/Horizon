import test from "node:test";
import assert from "node:assert/strict";
import {
  buildChangedClassificationPatch,
  buildTransactionClassificationSuggestion,
  findSimilarTransactions,
  normalizeTransactionTitle,
} from "./similarTransactionClassification.js";

test("normalizes casing, Unicode composition and repeated whitespace without fuzzy matching", () => {
  assert.equal(normalizeTransactionTitle("  CAFÉ\t MARKET  "), normalizeTransactionTitle("Cafe\u0301 market"));
  assert.notEqual(normalizeTransactionTitle("CARREFOUR MARKET"), normalizeTransactionTitle("CARREFOUR MARKETS"));
});

test("finds only displayed exact-title and same-type candidates", () => {
  const candidates = findSimilarTransactions([
    { id: "source", description: "CARREFOUR MARKET", type: "depense" },
    { id: "same", description: "  carrefour   market ", type: "dépense" },
    { id: "other-type", description: "CARREFOUR MARKET", type: "revenu" },
    { id: "different", description: "CARREFOUR MARKETS", type: "depense" },
    { id: "deleted", description: "CARREFOUR MARKET", type: "depense", isDeleted: true },
    { id: "archived", description: "CARREFOUR MARKET", type: "depense", isArchived: true },
  ], { id: "source", description: "CARREFOUR MARKET", type: "depense" });

  assert.deepEqual(candidates.map(({ id }) => id), ["same"]);
});

test("returns no candidates for an empty title", () => {
  assert.deepEqual(findSimilarTransactions([{ id: "other", description: "", type: "depense" }], {
    id: "source",
    description: " ",
    type: "depense",
  }), []);
});

test("propagates only changed non-empty supported classification fields", () => {
  assert.deepEqual(buildChangedClassificationPatch(
    { categoryId: "old", subcategoryId: "before", accountId: "account-1", fixedExpenseId: "fixed-1" },
    { categoryId: "new", subcategoryId: "", accountId: "account-1", thirdPartyId: "third-1", fixedExpenseId: "fixed-2", montant: 99 }
  ), {
    categoryId: "new",
    thirdPartyId: "third-1",
  });
});

test("suggests a high confidence classification for a known transaction", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    {
      id: "history-1",
      description: "CARREFOUR MARKET",
      type: "depense",
      accountId: "acc-1",
      categoryId: "cat-food",
      subcategoryId: "sub-groceries",
      thirdPartyId: "third-carrefour",
      activityId: "act-home",
      projectId: "proj-1",
    },
  ], {
    description: "  carrefour   market ",
    type: "dépense",
    accountId: "acc-1",
  });

  assert.equal(suggestion.score, 95);
  assert.equal(suggestion.label, "Suggestion très fiable");
  assert.deepEqual(suggestion.patch, {
    categoryId: "cat-food",
    subcategoryId: "sub-groceries",
    thirdPartyId: "third-carrefour",
    activityId: "act-home",
    projectId: "proj-1",
    accountId: "acc-1",
  });
});

test("returns no suggestion for an unknown transaction", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "history-1", description: "CARREFOUR MARKET", type: "depense", accountId: "acc-1", categoryId: "cat-food" },
  ], {
    description: "BOULANGERIE",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(suggestion, null);
});

test("uses the strongest history when several candidates agree", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "one", description: "SNCF", type: "depense", accountId: "acc-1", categoryId: "cat-transport" },
    { id: "two", description: "sncf", type: "depense", accountId: "acc-1", categoryId: "cat-transport" },
  ], {
    description: "SNCF",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(suggestion.score, 100);
  assert.equal(suggestion.label, "Suggestion très fiable");
  assert.equal(suggestion.patch.categoryId, "cat-transport");
});

test("returns a standard suggestion between 80 and 95 percent", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "one", description: "SNCF", type: "depense", accountId: "acc-1", categoryId: "cat-transport" },
    { id: "two", description: "sncf", type: "depense", accountId: "acc-1", categoryId: "cat-transport" },
    { id: "three", description: "SNCF", type: "depense", accountId: "acc-1", categoryId: "cat-leisure" },
  ], {
    description: "SNCF",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(suggestion.score, 83);
  assert.equal(suggestion.label, "Suggestion");
  assert.equal(suggestion.patch.categoryId, "cat-transport");
});

test("low confidence contradictory history is ignored", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "one", description: "AMAZON", type: "depense", accountId: "acc-1", categoryId: "cat-home" },
    { id: "two", description: "AMAZON", type: "depense", accountId: "acc-1", categoryId: "cat-work" },
    { id: "three", description: "AMAZON", type: "depense", accountId: "acc-1", categoryId: "cat-gifts" },
  ], {
    description: "AMAZON",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(suggestion, null);
});

test("equality produces no invalid suggestion", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "one", description: "UBER", type: "depense", accountId: "acc-1", categoryId: "cat-transport" },
    { id: "two", description: "UBER", type: "depense", accountId: "acc-1", categoryId: "cat-travel" },
  ], {
    description: "UBER",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(suggestion, null);
});

test("does not compare across accounts or types", () => {
  const suggestion = buildTransactionClassificationSuggestion([
    { id: "account", description: "CAF", type: "revenu", accountId: "acc-2", categoryId: "cat-aid" },
    { id: "type", description: "CAF", type: "depense", accountId: "acc-1", categoryId: "cat-aid" },
  ], {
    description: "CAF",
    type: "revenu",
    accountId: "acc-1",
  });

  assert.equal(suggestion, null);
});
