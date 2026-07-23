import test from "node:test";
import assert from "node:assert/strict";
import { getRecurringIncomeApplicableAmount, getRecurringIncomeBaseAmount, getRecurringIncomeInitialAmount } from "./recurringIncomeAmount.js";

test("reads current, amount, initial and legacy base amounts in priority order", () => {
  assert.equal(getRecurringIncomeBaseAmount({ currentAmount: 1200, amount: 1150, initialAmount: 1100, baseAmount: 1000 }), 1200);
  assert.equal(getRecurringIncomeBaseAmount({ amount: "1150", initialAmount: 1100 }), 1150);
  assert.equal(getRecurringIncomeBaseAmount({ initialAmount: 1100 }), 1100);
  assert.equal(getRecurringIncomeBaseAmount({ baseAmount: "1100" }), 1100);
});

test("preserves an intentional numeric or string zero", () => {
  assert.equal(getRecurringIncomeBaseAmount({ currentAmount: 0, initialAmount: 1100 }), 0);
  assert.equal(getRecurringIncomeBaseAmount({ currentAmount: "0", initialAmount: 1100 }), 0);
});

test("keeps the contractual initial amount distinct from a current amount", () => {
  assert.equal(getRecurringIncomeInitialAmount({ initialAmount: 1100, currentAmount: 1200 }), 1100);
  assert.equal(getRecurringIncomeInitialAmount({ baseAmount: "1100" }), 1100);
});

test("returns zero for absent or invalid amounts", () => {
  assert.equal(getRecurringIncomeBaseAmount({}), 0);
  assert.equal(getRecurringIncomeBaseAmount({ amount: "not-a-number" }), 0);
});

test("applies the latest eligible variation without treating future variations as current", () => {
  const income = {
    initialAmount: 1100,
    variations: [
      { effectiveDate: "2026-08-01", amount: "1150" },
      { effectiveDate: "2027-01-01", amount: 1200 },
    ],
  };

  assert.equal(getRecurringIncomeApplicableAmount(income, "2026-07-14"), 1100);
  assert.equal(getRecurringIncomeApplicableAmount(income, "2026-08-31"), 1150);
});
