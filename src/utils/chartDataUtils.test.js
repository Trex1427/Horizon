import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBudgetComparisonData,
  buildIncomeExpenseTrendData,
  buildMonthlyExpenseCategoryData,
  buildMonthlyIncomeCategoryData,
  calculateSharePercentages,
  mergeSmallCategories,
} from "./chartDataUtils.js";

test("calculateSharePercentages computes percentages from total", () => {
  const data = calculateSharePercentages([
    { name: "A", amount: 30 },
    { name: "B", amount: 70 },
  ]);

  assert.equal(Math.round(data[0].percent), 30);
  assert.equal(Math.round(data[1].percent), 70);
});

test("mergeSmallCategories groups tail under Autres", () => {
  const merged = mergeSmallCategories(
    [
      { name: "A", amount: 50, count: 1, transactionIds: ["t1"], categoryIds: ["cat-a"] },
      { name: "B", amount: 40, count: 1, transactionIds: ["t2"], categoryIds: ["cat-b"] },
      { name: "C", amount: 30, count: 2, transactionIds: ["t3", "t4"], categoryIds: ["cat-c"] },
      { name: "D", amount: 20, count: 1, transactionIds: ["t5"], categoryIds: ["cat-d"] },
    ],
    3
  );

  assert.equal(merged.length, 3);
  assert.equal(merged[2].name, "Autres");
  assert.equal(merged[2].amount, 50);
  assert.equal(merged[2].count, 3);
  assert.deepEqual(merged[2].transactionIds.sort(), ["t3", "t4", "t5"]);
  assert.deepEqual(merged[2].categoryIds.sort(), ["cat-c", "cat-d"]);
});

test("buildMonthlyExpenseCategoryData filters current month and merges categories", () => {
  const rows = buildMonthlyExpenseCategoryData(
    [
      { type: "depense", montant: 40, categoryName: "Alimentation", date: "2026-07-10" },
      { type: "depense", montant: 20, categoryName: "Transport", date: "2026-07-11" },
      { type: "revenu", montant: 100, categoryName: "Salaire", date: "2026-07-10" },
      { type: "depense", montant: 15, categoryName: "Loisirs", date: "2026-07-12" },
      { type: "depense", montant: 10, categoryName: "Sante", date: "2026-07-13" },
    ],
    { monthDate: "2026-07-01", maxCategories: 3 }
  );

  assert.equal(rows.total, 85);
  assert.equal(rows.categories.length, 3);
  assert.equal(rows.categories[2].name, "Autres");
});

test("buildMonthlyIncomeCategoryData aggregates revenus and legacy income/recette types", () => {
  const rows = buildMonthlyIncomeCategoryData(
    [
      { type: "revenu", montant: 800, categoryName: "Salaire", date: "2026-07-10" },
      { type: "income", montant: 120, categoryName: "Freelance", date: "2026-07-11" },
      { type: "recette", montant: 80, categoryName: "Remboursement", date: "2026-07-11" },
      { type: "depense", montant: 50, categoryName: "Courses", date: "2026-07-11" },
    ],
    { monthDate: "2026-07-01", maxCategories: 5 }
  );

  assert.equal(rows.total, 1000);
  assert.equal(rows.categories.length, 3);
});

test("buildBudgetComparisonData marks overruns", () => {
  const rows = buildBudgetComparisonData([
    { id: "a", name: "Alimentation", plannedAmount: 200, spentAmount: 150 },
    { id: "b", name: "Loisirs", plannedAmount: 100, spentAmount: 130 },
  ]);

  assert.equal(rows[0].overrun, false);
  assert.equal(rows[1].overrun, true);
  assert.equal(rows[1].delta, -30);
});

test("buildIncomeExpenseTrendData creates year buckets", () => {
  const rows = buildIncomeExpenseTrendData(
    [
      { type: "revenu", montant: 2000, date: "2026-01-04" },
      { type: "depense", montant: 700, date: "2026-01-12" },
      { type: "depense", montant: 300, date: "2026-06-20" },
    ],
    "currentYear"
  );

  assert.equal(rows.length, 12);
  assert.equal(rows[0].revenu, 2000);
  assert.equal(rows[0].depense, 700);
  assert.equal(rows[5].depense, 300);
});
