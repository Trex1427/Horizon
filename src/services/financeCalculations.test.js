import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAccountsBalances,
  buildBudgetFixedExpenseReservationMap,
  calculateBudgetReservedFixedExpenseAmount,
  normalizeCategoryName,
  isTransactionMatchingBudgetCategory,
  matchesBudgetPeriod,
  calculateBudgetSpentAmount,
  calculateTransfersNetImpact,
  matchesExpectedTransaction,
  selectNonOverlappingBudgetsForForecast,
} from "./financeCalculations.js";

test("normalizeCategoryName trims and lowercases", () => {
  assert.equal(normalizeCategoryName("  Alimentation  "), "alimentation");
  assert.equal(normalizeCategoryName(""), "");
  assert.equal(normalizeCategoryName(null), "");
});

test("isTransactionMatchingBudgetCategory matches by categoryId when available", () => {
  const budget = { categoryId: "cat-food", categoryName: "Alimentation" };
  const matchingTransaction = { categoryId: "cat-food", categoryName: "Courses" };
  const nonMatchingTransaction = { categoryId: "cat-other", categoryName: "Alimentation" };

  assert.equal(isTransactionMatchingBudgetCategory(budget, matchingTransaction), true);
  assert.equal(isTransactionMatchingBudgetCategory(budget, nonMatchingTransaction), false);
});

test("isTransactionMatchingBudgetCategory falls back to normalized legacy names", () => {
  const budget = { categoryName: "  Alimentation " };
  const matchingTransaction = { categorie: "alimentation" };
  const nonMatchingTransaction = { categorie: "Transport" };

  assert.equal(isTransactionMatchingBudgetCategory(budget, matchingTransaction), true);
  assert.equal(isTransactionMatchingBudgetCategory(budget, nonMatchingTransaction), false);
});

test("matchesBudgetPeriod filters transaction within inclusive period", () => {
  const budget = {
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  };

  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-01" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-15" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-31" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-06-30" }), false);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-08-01" }), false);
});

test("matchesBudgetPeriod supports monthly budgets", () => {
  const budget = { periodicity: "monthly" };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-05" }, { referenceDate: "2026-07-20" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-06-30" }, { referenceDate: "2026-07-20" }), false);
});

test("matchesBudgetPeriod supports quarterly budgets", () => {
  const budget = { periodicity: "quarterly" };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-05-01" }, { referenceDate: "2026-06-10" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-01" }, { referenceDate: "2026-06-10" }), false);
});

test("matchesBudgetPeriod supports semi-annual budgets", () => {
  const budget = { periodicity: "semiAnnual" };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-04-01" }, { referenceDate: "2026-05-10" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-10-01" }, { referenceDate: "2026-05-10" }), false);
});

test("matchesBudgetPeriod supports annual budgets", () => {
  const budget = { periodicity: "annual" };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-01-01" }, { referenceDate: "2026-08-10" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2027-01-01" }, { referenceDate: "2026-08-10" }), false);
});

test("matchesBudgetPeriod supports custom budgets", () => {
  const budget = { periodicity: "custom", startDate: "2026-03-01", endDate: "2026-03-31" };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-03-20" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-04-01" }), false);
});

test("matchesBudgetPeriod supports rolling monthly budgets", () => {
  const budget = { periodicity: "monthly", rollingPeriod: true };
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-16" }, { referenceDate: "2026-08-15" }), true);
  assert.equal(matchesBudgetPeriod(budget, { date: "2026-07-14" }, { referenceDate: "2026-08-15" }), false);
});

test("calculateBudgetSpentAmount sums only matching depense transactions", () => {
  const budget = {
    categoryId: "cat-food",
    categoryName: "Alimentation",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  };

  const transactions = [
    { type: "depense", categoryId: "cat-food", montant: 20, date: "2026-07-05" },
    { type: "depense", categoryId: "cat-food", montant: 35, date: "2026-07-20" },
    { type: "depense", categoryId: "cat-other", montant: 100, date: "2026-07-10" },
    { type: "revenu", categoryId: "cat-food", montant: 90, date: "2026-07-12" },
    { type: "depense", categoryId: "cat-food", montant: 12, date: "2026-08-01" },
  ];

  assert.equal(calculateBudgetSpentAmount(budget, transactions), 55);
});

test("calculateBudgetSpentAmount ignores cash adjustments", () => {
  const budget = {
    categoryId: "cat-food",
    categoryName: "Alimentation",
    startDate: "2026-07-01",
    endDate: "2026-07-31",
  };

  const transactions = [
    { type: "adjustment", categoryId: "cat-food", montant: 15, date: "2026-07-10" },
    { type: "depense", categoryId: "cat-food", montant: 20, date: "2026-07-11" },
  ];

  assert.equal(calculateBudgetSpentAmount(budget, transactions), 20);
});

test("matchesExpectedTransaction applies amount tolerance and month range", () => {
  const expectedItem = {
    accountId: "acc-1",
    categoryId: "cat-salary",
    categoryName: "Salaire",
  };

  const baseOptions = {
    expectedType: "revenu",
    expectedAmount: 1000,
    monthStart: "2026-07-01",
    monthEnd: "2026-07-31",
  };

  const matchingWithTolerance = {
    type: "revenu",
    accountId: "acc-1",
    categoryId: "cat-salary",
    montant: 1000.005,
    date: "2026-07-10",
  };

  const outsideTolerance = {
    type: "revenu",
    accountId: "acc-1",
    categoryId: "cat-salary",
    montant: 1000.02,
    date: "2026-07-10",
  };

  const outsideMonth = {
    type: "revenu",
    accountId: "acc-1",
    categoryId: "cat-salary",
    montant: 1000,
    date: "2026-08-01",
  };

  assert.equal(matchesExpectedTransaction(matchingWithTolerance, expectedItem, baseOptions), true);
  assert.equal(matchesExpectedTransaction(outsideTolerance, expectedItem, baseOptions), false);
  assert.equal(matchesExpectedTransaction(outsideMonth, expectedItem, baseOptions), false);
});

test("matchesExpectedTransaction supports legacy category-name fallback", () => {
  const expectedItem = {
    accountId: "acc-1",
    categoryName: "  Alimentation ",
  };

  const transaction = {
    type: "depense",
    accountId: "acc-1",
    categorie: "alimentation",
    montant: 50,
    date: "2026-07-09",
  };

  const options = {
    expectedType: "depense",
    expectedAmount: 50,
    monthStart: "2026-07-01",
    monthEnd: "2026-07-31",
  };

  assert.equal(matchesExpectedTransaction(transaction, expectedItem, options), true);
});

test("calculateAccountsBalances applies transfers without impacting net worth", () => {
  const accounts = [
    { id: "acc-source", name: "Compte courant", initialBalance: 1000 },
    { id: "acc-destination", name: "Livret A", initialBalance: 200 },
  ];

  const balances = calculateAccountsBalances(
    accounts,
    [
      { type: "revenu", accountId: "acc-source", montant: 100 },
      { type: "depense", accountId: "acc-source", montant: 50 },
    ],
    [
      {
        date: "2026-07-11",
        amount: 500,
        sourceAccountId: "acc-source",
        destinationAccountId: "acc-destination",
      },
    ]
  );

  assert.equal(balances.find((account) => account.id === "acc-source")?.balance, 550);
  assert.equal(balances.find((account) => account.id === "acc-destination")?.balance, 700);
});

test("calculateAccountsBalances applies explicit cash adjustments without classifying them as income or expense", () => {
  const balances = calculateAccountsBalances(
    [{ id: "cash", name: "Espèces", initialBalance: 0 }],
    [
      { type: "adjustment", accountId: "cash", montant: 87.35 },
      { type: "adjustment", accountId: "cash", montant: -7.35 },
      { type: "revenu", accountId: "cash", montant: 10 },
      { type: "depense", accountId: "cash", montant: 5 },
    ],
    []
  );

  assert.equal(balances[0].balance, 85);
});

test("calculateTransfersNetImpact keeps zero global impact for internal transfers", () => {
  const netImpact = calculateTransfersNetImpact([
    { date: "2026-07-11", amount: 500, sourceAccountId: "acc-1", destinationAccountId: "acc-2" },
    { date: "2026-07-12", amount: 150, sourceAccountId: "acc-2", destinationAccountId: "acc-1" },
  ]);

  assert.equal(netImpact, 0);
});

test("calculateBudgetReservedFixedExpenseAmount reserves only matching category and account", () => {
  const budget = { categoryId: "energy", categoryName: "Energie", accountId: "account-1" };
  const reserved = calculateBudgetReservedFixedExpenseAmount(budget, [
    { categoryId: "energy", accountId: "account-1", amount: 40 },
    { categoryId: "energy", accountId: "account-2", amount: 25 },
    { categoryId: "food", accountId: "account-1", amount: 30 },
  ]);
  assert.equal(reserved, 40);
});
test("subcategory reservations target the exact envelope and never sibling envelopes", () => {
  const budgets = [
    { id: "rent", categoryId: "housing", subcategoryId: "rent", accountId: "main" },
    { id: "electricity", categoryId: "housing", subcategoryId: "electricity", accountId: "main" },
    { id: "insurance", categoryId: "housing", subcategoryId: "insurance", accountId: "main" },
  ];
  const reservations = buildBudgetFixedExpenseReservationMap(budgets, [{
    categoryId: "housing",
    subcategoryId: "electricity",
    accountId: "main",
    amount: 120,
  }]);

  assert.equal(reservations.get(budgets[0]), 0);
  assert.equal(reservations.get(budgets[1]), 120);
  assert.equal(reservations.get(budgets[2]), 0);
});

test("subcategory reservation falls back to category and prioritizes account-specific budget", () => {
  const globalCategoryBudget = { id: "global", categoryId: "housing" };
  const accountCategoryBudget = { id: "main", categoryId: "housing", accountId: "main" };
  const reservations = buildBudgetFixedExpenseReservationMap(
    [globalCategoryBudget, accountCategoryBudget],
    [{ categoryId: "housing", subcategoryId: "electricity", accountId: "main", amount: 120 }]
  );

  assert.equal(reservations.get(globalCategoryBudget), 0);
  assert.equal(reservations.get(accountCategoryBudget), 120);
});

test("exact subcategory budget takes priority over category budget without double reservation", () => {
  const categoryBudget = { id: "housing", categoryId: "housing", accountId: "main" };
  const electricityBudget = { id: "electricity", categoryId: "housing", subcategoryId: "electricity", accountId: "main" };
  const reservations = buildBudgetFixedExpenseReservationMap(
    [categoryBudget, electricityBudget],
    [{ categoryId: "housing", subcategoryId: "electricity", accountId: "main", amount: 120 }]
  );

  assert.equal(reservations.get(categoryBudget), 0);
  assert.equal(reservations.get(electricityBudget), 120);
});

test("historical matching requires the expected subcategory and falls back only for legacy expected items", () => {
  const expected = { categoryId: "housing", subcategoryId: "electricity", accountId: "main" };
  const options = {
    expectedType: "depense",
    expectedAmount: 120,
    monthStart: new Date(2026, 7, 1),
    monthEnd: new Date(2026, 7, 31, 23, 59, 59),
  };

  assert.equal(matchesExpectedTransaction({
    type: "depense", montant: 120, date: "2026-08-10", categoryId: "housing", subcategoryId: "water", accountId: "main",
  }, expected, options), false);
  const transactionWithoutSubcategory = {
    type: "depense", montant: 120, date: "2026-08-10", categoryId: "housing", accountId: "main",
  };
  assert.equal(matchesExpectedTransaction(transactionWithoutSubcategory, expected, options), false);
  assert.equal(matchesExpectedTransaction(transactionWithoutSubcategory, { ...expected, subcategoryId: "" }, options), true);
});
test("global category budget replaces its detailed envelopes in financial totals", () => {
  const globalBudget = { id: "global", categoryId: "housing", accountId: "main", startDate: "2026-01-01", endDate: "2026-12-31", amount: 1000 };
  const details = [
    { id: "rent", categoryId: "housing", subcategoryId: "rent", accountId: "main", startDate: "2026-01-01", endDate: "2026-12-31", amount: 700 },
    { id: "electricity", categoryId: "housing", subcategoryId: "electricity", accountId: "main", startDate: "2026-01-01", endDate: "2026-12-31", amount: 150 },
    { id: "insurance", categoryId: "housing", subcategoryId: "insurance", accountId: "main", startDate: "2026-01-01", endDate: "2026-12-31", amount: 150 },
  ];
  assert.deepEqual(selectNonOverlappingBudgetsForForecast([globalBudget, ...details]), [globalBudget]);
  assert.deepEqual(selectNonOverlappingBudgetsForForecast(details), details);
});
