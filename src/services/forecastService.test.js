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

test("an explicitly linked real income replaces its forecast even when legacy fields differ", () => {
  const forecast = calculateMonthlyForecast({
    recurringIncome: [{ ...franceTravail, startDate: "2026-01-01" }],
    transactions: [{
      id: "real-income",
      recurringIncomeId: franceTravail.id,
      type: "revenu",
      date: "2026-08-10",
      montant: 1095,
      categoryId: "different-category",
    }],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedRecurringIncome, 0);
});

test("one legacy transaction cannot replace two ambiguous recurring incomes", () => {
  const common = {
    categoryId: "salary",
    accountId: "main",
    initialAmount: 1100,
    startDate: "2026-01-01",
    frequency: "mensuel",
    isActive: true,
  };
  const forecast = calculateMonthlyForecast({
    recurringIncome: [{ ...common, id: "salary-a" }, { ...common, id: "salary-b" }],
    transactions: [{
      id: "ambiguous-real-income",
      type: "revenu",
      date: "2026-08-10",
      montant: 1100,
      categoryId: "salary",
      accountId: "main",
    }],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedRecurringIncome, 2200);
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

test("variable fixed-expense occurrence substitutes forecast without explicit link", () => {
  const fixedExpense = {
    id: "fixed-orange",
    name: "Orange",
    thirdPartyName: "Orange",
    accountId: "account-current",
    amountType: "variable",
    initialAmount: 29.99,
    frequency: "monthly",
    startDate: "2026-01-01",
    isActive: true,
  };
  const forecast = calculateMonthlyForecast({
    fixedExpenses: [fixedExpense],
    transactions: [{
      id: "orange-august",
      date: "2026-08-10",
      montant: 34.99,
      type: "depense",
      merchant: "Orange",
      accountId: "account-current",
    }],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedFixedExpenses, 0);
});

test("a pending fixed expense reserves its category budget instead of being added twice", () => {
  const fixedExpense = {
    id: "fixed-edf",
    name: "EDF",
    categoryId: "energy",
    categoryName: "Energie",
    accountId: "account-current",
    initialAmount: 40,
    frequency: "monthly",
    startDate: "2026-01-01",
    isActive: true,
  };
  const budget = {
    id: "budget-energy",
    categoryId: "energy",
    categoryName: "Energie",
    accountId: "account-current",
    amount: 100,
    typeBudget: "depense",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    isActive: true,
  };

  const forecast = calculateMonthlyForecast({
    fixedExpenses: [fixedExpense],
    budgets: [budget],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedFixedExpenses, 40);
  assert.equal(forecast.remainingBudgets, 60);
  assert.equal(forecast.forecastEndOfMonth, -100);
});

test("a linked imported or manual transaction consumes the budget without duplicating the fixed expense", () => {
  const forecast = calculateMonthlyForecast({
    accounts: [{ id: "account-current", initialBalance: 1000 }],
    transactions: [{
      id: "tx-edf",
      accountId: "account-current",
      categoryId: "energy",
      categoryName: "Energie",
      date: "2026-08-10",
      montant: 57,
      type: "depense",
      fixedExpenseId: "fixed-edf",
      isFixedExpense: true,
    }],
    fixedExpenses: [{
      id: "fixed-edf",
      accountId: "account-current",
      categoryId: "energy",
      categoryName: "Energie",
      initialAmount: 40,
      frequency: "monthly",
      startDate: "2026-01-01",
      isActive: true,
    }],
    budgets: [{
      categoryId: "energy",
      categoryName: "Energie",
      accountId: "account-current",
      amount: 100,
      typeBudget: "depense",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      isActive: true,
    }],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.currentBalance, 943);
  assert.equal(forecast.expectedFixedExpenses, 0);
  assert.equal(forecast.remainingBudgets, 43);
  assert.equal(forecast.forecastEndOfMonth, 900);
});
test("subcategory budgets reserve electricity without reducing rent or insurance envelopes", () => {
  const forecast = calculateMonthlyForecast({
    fixedExpenses: [{
      id: "fixed-electricity",
      categoryId: "housing",
      categoryName: "Logement",
      subcategoryId: "electricity",
      subcategoryName: "Electricite",
      accountId: "main",
      initialAmount: 120,
      frequency: "monthly",
      startDate: "2026-01-01",
      isActive: true,
    }],
    budgets: [
      { categoryId: "housing", subcategoryId: "rent", accountId: "main", amount: 700, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
      { categoryId: "housing", subcategoryId: "electricity", accountId: "main", amount: 150, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
      { categoryId: "housing", subcategoryId: "insurance", accountId: "main", amount: 150, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
    ],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedFixedExpenses, 120);
  assert.equal(forecast.remainingBudgets, 880);
  assert.equal(forecast.forecastEndOfMonth, -1000);
});

test("several fixed expenses reserve only their matching subcategories", () => {
  const commonFixedExpense = {
    categoryId: "housing",
    categoryName: "Logement",
    accountId: "main",
    frequency: "monthly",
    startDate: "2026-01-01",
    isActive: true,
  };
  const forecast = calculateMonthlyForecast({
    fixedExpenses: [
      { ...commonFixedExpense, id: "electricity", subcategoryId: "electricity", initialAmount: 120 },
      { ...commonFixedExpense, id: "insurance", subcategoryId: "insurance", initialAmount: 50 },
    ],
    budgets: [
      { categoryId: "housing", subcategoryId: "rent", accountId: "main", amount: 700, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
      { categoryId: "housing", subcategoryId: "electricity", accountId: "main", amount: 150, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
      { categoryId: "housing", subcategoryId: "insurance", accountId: "main", amount: 150, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
    ],
    referenceDate: new Date(2026, 7, 14),
  });

  assert.equal(forecast.expectedFixedExpenses, 170);
  assert.equal(forecast.remainingBudgets, 830);
  assert.equal(forecast.forecastEndOfMonth, -1000);
});
test("global and detailed budgets coexist without doubling the category total", () => {
  const common = { categoryId: "housing", accountId: "main", typeBudget: "depense", startDate: "2026-01-01", endDate: "2026-12-31", isActive: true };
  const forecast = calculateMonthlyForecast({
    fixedExpenses: [{ ...common, id: "fixed-electricity", subcategoryId: "electricity", initialAmount: 120, frequency: "monthly" }],
    budgets: [
      { ...common, id: "global", amount: 1000 },
      { ...common, id: "rent", subcategoryId: "rent", amount: 700 },
      { ...common, id: "electricity", subcategoryId: "electricity", amount: 150 },
      { ...common, id: "insurance", subcategoryId: "insurance", amount: 150 },
    ],
    referenceDate: new Date(2026, 7, 14),
  });
  assert.equal(forecast.expectedFixedExpenses, 120);
  assert.equal(forecast.remainingBudgets, 880);
  assert.equal(forecast.forecastEndOfMonth, -1000);
});
