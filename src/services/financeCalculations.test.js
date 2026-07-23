import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateAccountsBalances,
  normalizeCategoryName,
  isTransactionMatchingBudgetCategory,
  matchesBudgetPeriod,
  calculateBudgetSpentAmount,
  calculateTransfersNetImpact,
  matchesExpectedTransaction,
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
