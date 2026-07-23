import test from "node:test";
import assert from "node:assert/strict";
import { getAnalysisTrendChartCopy } from "./analysisTrendChartConfig.js";

test("income trend copy never uses depense wording", () => {
  const incomeCopy = getAnalysisTrendChartCopy("variableIncome", "week");

  const combined = [
    incomeCopy.title,
    incomeCopy.subtitle,
    incomeCopy.emptyMessage,
    incomeCopy.revenueLabel,
  ].join(" ").toLowerCase();

  assert.equal(incomeCopy.hideExpense, true);
  assert.equal(combined.includes("depense"), false);
});

test("expense trend copy uses depense labels and hides revenus", () => {
  const expenseCopy = getAnalysisTrendChartCopy("variableExpenses", "month");

  assert.equal(expenseCopy.hideRevenue, true);
  assert.equal(String(expenseCopy.title).toLowerCase().includes("depense"), true);
});
