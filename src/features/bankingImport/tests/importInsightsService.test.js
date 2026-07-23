import test from "node:test";
import assert from "node:assert/strict";
import { detectRecurringCandidates, computeImportReconciliation } from "../services/importInsightsService.js";
import { suggestCategory } from "../services/categorySuggestionService.js";

test("computeImportReconciliation returns null when statement balance is absent", () => {
  const result = computeImportReconciliation({ account: { id: "acc-1", initialBalance: 0 }, existingTransactions: [], importRows: [], statementBalance: null });
  assert.equal(result, null);
});

test("computeImportReconciliation computes horizon delta when statement balance exists", () => {
  const result = computeImportReconciliation({
    account: { id: "acc-1", initialBalance: 100 },
    existingTransactions: [{ accountId: "acc-1", type: "revenu", montant: 50 }],
    importRows: [{ userDecision: "import", accountId: "acc-1", type: "depense", amount: -10 }],
    statementBalance: 130,
  });

  assert.equal(result.horizonBalance, 140);
  assert.equal(result.delta, 10);
});

test("detectRecurringCandidates finds monthly-like repeated rows without auto creating anything", () => {
  const candidates = detectRecurringCandidates([
    { userDecision: "import", type: "depense", normalizedLabel: "NETFLIX", rawLabel: "NETFLIX", amount: -15 },
    { userDecision: "import", type: "depense", normalizedLabel: "NETFLIX", rawLabel: "NETFLIX", amount: -15 },
    { userDecision: "import", type: "depense", normalizedLabel: "NETFLIX", rawLabel: "NETFLIX", amount: -15 },
  ]);

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].autoCreated, false);
});

test("suggestCategory remains neutral and does not map merchant to category", () => {
  const suggestion = suggestCategory({ merchant: "Carrefour", rawLabel: "CB CARREFOUR" }, { categories: [] });
  assert.equal(suggestion.categoryId, null);
  assert.equal(suggestion.confidence, 0);
});