import test from "node:test";
import assert from "node:assert/strict";
import { areBudgetsSameEnvelope, buildBudgetWritePayload, findDuplicateBudgetEnvelope } from "./budgetModel.js";

const baseBudget = {
  id: "global",
  accountId: "main",
  categoryId: "housing",
  subcategoryId: null,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  periodType: "mensuel",
  typeBudget: "depense",
  isActive: true,
};

test("budget payload persists optional subcategory names using existing conventions", () => {
  const categoryBudget = buildBudgetWritePayload({ ...baseBudget, amount: 1000, categoryName: "Logement" });
  assert.equal(categoryBudget.subcategoryId, null);
  assert.equal(categoryBudget.subcategoryName, null);

  const detailedBudget = buildBudgetWritePayload({
    ...baseBudget, amount: 150, categoryName: "Logement", subcategoryId: "electricity", subcategoryName: "Electricite",
  });
  assert.equal(detailedBudget.subcategoryId, "electricity");
  assert.equal(detailedBudget.subcategoryName, "Electricite");
});

test("identical envelopes are duplicates while category and subcategory budgets may coexist", () => {
  const same = { ...baseBudget, id: "copy" };
  const detailed = { ...baseBudget, id: "electricity", subcategoryId: "electricity" };
  assert.equal(areBudgetsSameEnvelope(baseBudget, same), true);
  assert.equal(areBudgetsSameEnvelope(baseBudget, detailed), false);
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], same)?.id, "global");
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], detailed), null);
});

test("budget uniqueness remains isolated by account and period", () => {
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, accountId: "savings" }), false);
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, startDate: "2026-01-20" }), true);
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, startDate: "2027-01-01" }), false);
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], { ...baseBudget }, "global"), null);
});
