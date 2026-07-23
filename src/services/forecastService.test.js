import test from "node:test";
import assert from "node:assert/strict";
import { calculateMonthlyForecast } from "./forecastService.js";

const franceTravail = {
  id: "france-travail",
  name: "France Travail",
  initialAmount: 1100,
  frequency: "mensuel",
  startDate: "2026-08-01",
  endDate: null,
  variations: [],
  isActive: true,
};

test("future recurring income is excluded before its start month and included at 1100 in its first month", () => {
  const july = calculateMonthlyForecast({ recurringIncome: [franceTravail], referenceDate: new Date(2026, 6, 14) });
  const august = calculateMonthlyForecast({ recurringIncome: [franceTravail], referenceDate: new Date(2026, 7, 14) });

  assert.equal(july.expectedRecurringIncome, 0);
  assert.equal(july.forecastEndOfMonth, 0);
  assert.equal(august.expectedRecurringIncome, 1100);
  assert.equal(august.forecastEndOfMonth, 1100);
});

test("forecast supports legacy baseAmount, string values and currentAmount precedence", () => {
  const forecast = calculateMonthlyForecast({
    recurringIncome: [
      { ...franceTravail, id: "legacy", startDate: "2026-01-01", initialAmount: undefined, baseAmount: "1100" },
      { ...franceTravail, id: "current", startDate: "2026-01-01", currentAmount: 1200 },
    ],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedRecurringIncome, 2300);
  assert.equal(forecast.forecastEndOfMonth, 2300);
});

test("inactive and intentionally zero recurring income do not change forecast", () => {
  const forecast = calculateMonthlyForecast({
    recurringIncome: [
      { ...franceTravail, startDate: "2026-01-01", isActive: false },
      { ...franceTravail, id: "zero", startDate: "2026-01-01", currentAmount: 0 },
    ],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedRecurringIncome, 0);
});

test("linked fixed-expense occurrence substitutes forecast even when actual amount differs", () => {
  const fixedExpense = {
    id: "fixed-edf",
    name: "EDF",
    initialAmount: 40,
    frequency: "monthly",
    startDate: "2026-01-01",
    isActive: true,
  };
  const forecast = calculateMonthlyForecast({
    fixedExpenses: [fixedExpense],
    transactions: [{
      id: "edf-august",
      date: "2026-08-10",
      montant: 57.25,
      type: "depense",
      fixedExpenseId: "fixed-edf",
    }],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedFixedExpenses, 0);
});
