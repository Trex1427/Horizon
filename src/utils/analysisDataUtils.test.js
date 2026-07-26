import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAnalysisSnapshot,
  computeVariation,
  filterTransactionsByRangeAndAccount,
  getPeriodRange,
  getPreviousPeriodRange,
  groupByCategory,
  groupRecurringIncomeBySource,
  groupByPeriod,
} from "./analysisDataUtils.js";
import { normalizeTransactionType } from "./transactionTypeUtils.js";

const referenceDate = new Date("2026-07-15T10:00:00Z");

const transactions = [
  { id: "t1", type: "depense", montant: 60, date: "2026-07-06", categoryName: "Courses", accountId: "acc-1" },
  { id: "t2", type: "depense", montant: 40, date: "2026-07-09", categoryName: "Transport", accountId: "acc-1" },
  { id: "t3", type: "revenu", montant: 2000, date: "2026-07-02", categoryName: "Salaire", accountId: "acc-1" },
  { id: "t4", type: "revenu", montant: 200, date: "2026-07-11", categoryName: "Freelance", accountId: "acc-1" },
  { id: "t5", type: "depense", montant: 50, date: "2026-06-05", categoryName: "Courses", accountId: "acc-1" },
  { id: "t6", type: "revenu", montant: 1800, date: "2026-06-02", categoryName: "Salaire", accountId: "acc-1" },
  { id: "t7", type: "depense", montant: 30, date: "2026-07-10", categoryName: "Courses", accountId: "acc-2" },
];

const fixedExpenses = [
  {
    id: "fx-rent",
    isActive: true,
    name: "Loyer",
    categoryName: "Courses",
    accountId: "acc-1",
    frequency: "monthly",
    initialAmount: 60,
    startDate: "2026-01-01",
  },
];

const recurringIncome = [
  {
    id: "inc-salary",
    isActive: true,
    name: "Salaire",
    categoryName: "Salaire",
    accountId: "acc-1",
    frequency: "mensuel",
    initialAmount: 2000,
    startDate: "2026-01-01",
  },
];

test("period range helpers return expected bounds", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const toLocalYmd = (value) => {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  };

  assert.equal(toLocalYmd(current.start), "2026-07-01");
  assert.equal(toLocalYmd(previous.start), "2026-06-01");
});

test("filterTransactionsByRangeAndAccount filters by account and date", () => {
  const range = getPeriodRange("currentMonth", referenceDate);
  const filtered = filterTransactionsByRangeAndAccount(transactions, range, "acc-2");

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "t7");
});

test("groupByCategory aggregates and supports Others grouping", () => {
  const grouped = groupByCategory([
    { categoryName: "A", amount: 50 },
    { categoryName: "B", amount: 40 },
    { categoryName: "C", amount: 30 },
    { categoryName: "D", amount: 20 },
  ], 3);

  assert.equal(grouped.length, 3);
  assert.equal(grouped[2].name, "Autres");
});

test("groupByPeriod creates weekly buckets", () => {
  const weekly = groupByPeriod([
    { date: "2026-07-02", montant: 10 },
    { date: "2026-07-08", montant: 20 },
    { date: "2026-07-20", montant: 30 },
  ], "week", "montant");

  assert.equal(weekly.length, 5);
  assert.equal(weekly[0].value, 10);
  assert.equal(weekly[1].value, 20);
  assert.equal(weekly[2].value, 30);
});

test("groupByPeriod creates monthly buckets", () => {
  const monthly = groupByPeriod([
    { date: "2026-05-02", amount: 10 },
    { date: "2026-05-10", amount: 5 },
    { date: "2026-06-04", amount: 8 },
  ], "month", "amount");

  assert.equal(monthly.length, 2);
  assert.equal(monthly[0].value, 15);
  assert.equal(monthly[1].value, 8);
});

test("computeVariation handles division by zero", () => {
  assert.equal(computeVariation(0, 0), 0);
  assert.equal(computeVariation(100, 0), null);
  assert.equal(Math.round(computeVariation(120, 100)), 20);
});

test("buildAnalysisSnapshot separates fixed and variable without double counting", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions,
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.fixedExpenses.total, 60);
  assert.equal(snapshot.variableExpenses.total, 40);
  assert.equal(snapshot.fixedIncome.total, 2000);
  assert.equal(snapshot.variableIncome.total, 200);
  assert.equal(snapshot.fixedExpenses.matchedTransactionsCount, 1);
  assert.equal(snapshot.fixedIncome.matchedTransactionsCount, 1);
});

test("buildAnalysisSnapshot handles empty data and missing fixed markers conservatively", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "x1", type: "depense", montant: 22, date: "2026-07-06", categoryName: "Autre", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    range: current,
    previousRange: previous,
    accountId: "all",
  });

  assert.equal(snapshot.fixedExpenses.total, 0);
  assert.equal(snapshot.variableExpenses.total, 22);
  assert.ok(snapshot.fallbackNotes.length > 0);
});

test("buildAnalysisSnapshot returns zeros on fully empty data", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [],
    fixedExpenses: [],
    recurringIncome: [],
    range: current,
    previousRange: previous,
    accountId: "all",
  });

  assert.equal(snapshot.totals.fixedExpenses, 0);
  assert.equal(snapshot.totals.variableExpenses, 0);
  assert.equal(snapshot.totals.fixedIncome, 0);
  assert.equal(snapshot.totals.variableIncome, 0);
  assert.equal(snapshot.fallbackNotes.length, 0);
});

test("buildAnalysisSnapshot increases variable income when a new income transaction is added", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      ...transactions,
      { id: "t8", type: "revenu", montant: 123.45, date: "2026-07-13", categoryName: "Prime", accountId: "acc-1" },
    ],
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableIncome.total, 323.45);
  assert.equal(snapshot.totals.analyticalBalance, 2223.45);
});

test("buildAnalysisSnapshot does not count expenses as income", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      ...transactions,
      { id: "t8", type: "depense", montant: 123.45, date: "2026-07-13", categoryName: "Prime", accountId: "acc-1" },
    ],
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableIncome.total, 200);
});

test("buildAnalysisSnapshot increases fixed income when recurring income is added", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions,
    fixedExpenses,
    recurringIncome: [
      ...recurringIncome,
      {
        id: "inc-rent",
        isActive: true,
        name: "Loyer recu",
        categoryName: "Location",
        accountId: "acc-1",
        frequency: "mensuel",
        initialAmount: 500,
        startDate: "2026-01-01",
      },
    ],
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.fixedIncome.total, 2500);
  assert.equal(snapshot.totals.analyticalBalance, 2600);
});

test("buildAnalysisSnapshot avoids double counting recurring income transactions", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: transactions.map((transaction) => (
      transaction.id === "t3"
        ? { ...transaction, type: "income" }
        : transaction
    )),
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.fixedIncome.total, 2000);
  assert.equal(snapshot.variableIncome.total, 200);
  assert.equal(snapshot.fixedIncome.matchedTransactionsCount, 1);
});

test("legacy income transaction types are normalized", () => {
  assert.equal(normalizeTransactionType("revenu"), "revenu");
  assert.equal(normalizeTransactionType("income"), "revenu");
  assert.equal(normalizeTransactionType("recette"), "revenu");
  assert.equal(normalizeTransactionType("expense"), "depense");
});

test("buildAnalysisSnapshot keeps period and account filters working with legacy types", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      ...transactions,
      { id: "t8", type: "income", montant: 90, date: "2026-07-15", categoryName: "Bonus", accountId: "acc-1" },
      { id: "t9", type: "recette", montant: 70, date: "2026-07-15", categoryName: "Bonus", accountId: "acc-2" },
      { id: "t10", type: "income", montant: 50, date: "2026-06-15", categoryName: "Bonus", accountId: "acc-1" },
    ],
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableIncome.total, 290);
});

test("buildAnalysisSnapshot category filter is case-insensitive for income rows", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      ...transactions,
      { id: "t8", type: "income", montant: 90, date: "2026-07-15", categoryName: "Bonus", accountId: "acc-1" },
    ],
    fixedExpenses,
    recurringIncome,
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "bonus",
  });

  assert.equal(snapshot.variableIncome.total, 90);
});

test("buildAnalysisSnapshot groups variable expenses by valid categoryId when legacy labels are empty", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "valid-category-id", type: "depense", montant: 12, date: "2026-07-10", categoryId: "cat-food", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "cat-food", name: "Alimentation", type: "depense", isActive: true },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableExpenses.total, 12);
  assert.equal(snapshot.variableExpenses.segments[0].categoryName, "Alimentation");
  assert.equal(snapshot.variableExpenses.segments[0].categoryId, "cat-food");
});

test("buildAnalysisSnapshot keeps truly uncategorized expenses under Sans categorie", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "no-category", type: "depense", montant: 9, date: "2026-07-10", categoryId: "", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "cat-food", name: "Alimentation", type: "depense", isActive: true },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableExpenses.segments[0].categoryName, "Sans categorie");
});

test("buildAnalysisSnapshot labels orphan categoryId explicitly", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "orphan-category", type: "depense", montant: 11, date: "2026-07-10", categoryId: "missing-category", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "cat-food", name: "Alimentation", type: "depense", isActive: true },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableExpenses.segments[0].categoryName, "Categorie introuvable");
  assert.equal(snapshot.variableExpenses.total, 11);
});

test("buildAnalysisSnapshot resolves parent category from a valid subcategory when categoryId is absent", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "subcategory-only", type: "depense", montant: 14, date: "2026-07-10", categoryId: "", subcategoryId: "sub-fuel", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "cat-transport", name: "Transport", type: "depense", isActive: true },
    ],
    subcategories: [
      { id: "sub-fuel", name: "Carburant", categoryId: "cat-transport", type: "depense", isActive: true },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableExpenses.segments[0].categoryName, "Transport");
  assert.equal(snapshot.variableExpenses.segments[0].categoryId, "cat-transport");
});

test("buildAnalysisSnapshot treats inactive categories as not found without changing totals", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions: [
      { id: "inactive-category", type: "depense", montant: 16, date: "2026-07-10", categoryId: "cat-old", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "cat-old", name: "Archivee", type: "depense", isActive: false },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  assert.equal(snapshot.variableExpenses.segments[0].categoryName, "Categorie introuvable");
  assert.equal(snapshot.variableExpenses.total, 16);
});

test("buildAnalysisSnapshot immediately reflects category changes from transaction data", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);
  const categories = [
    { id: "cat-food", name: "Alimentation", type: "depense", isActive: true },
    { id: "cat-bank", name: "Banque", type: "depense", isActive: true },
  ];
  const baseOptions = {
    fixedExpenses: [],
    recurringIncome: [],
    categories,
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  };

  const before = buildAnalysisSnapshot({
    ...baseOptions,
    transactions: [
      { id: "editable", type: "depense", montant: 20, date: "2026-07-10", categoryId: "", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
  });
  const afterAdd = buildAnalysisSnapshot({
    ...baseOptions,
    transactions: [
      { id: "editable", type: "depense", montant: 20, date: "2026-07-10", categoryId: "cat-food", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
  });
  const afterChange = buildAnalysisSnapshot({
    ...baseOptions,
    transactions: [
      { id: "editable", type: "depense", montant: 20, date: "2026-07-10", categoryId: "cat-bank", categoryName: "", categorie: "", accountId: "acc-1" },
    ],
  });

  assert.equal(before.variableExpenses.segments[0].categoryName, "Sans categorie");
  assert.equal(afterAdd.variableExpenses.segments[0].categoryName, "Alimentation");
  assert.equal(afterChange.variableExpenses.segments[0].categoryName, "Banque");
  assert.equal(before.variableExpenses.total, afterAdd.variableExpenses.total);
  assert.equal(afterAdd.variableExpenses.total, afterChange.variableExpenses.total);
});

test("buildAnalysisSnapshot preserves total while redistributing the seven real affected transactions", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);
  const affectedTransactions = [
    { id: "NoluWInfL1NkjSL0mqYQ", type: "depense", montant: 8, date: "2026-07-10", categoryId: "pmPZZSMH414dpolssCTM", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "OSBno3BWqPkcoBwLykJx", type: "depense", montant: 8.5, date: "2026-07-10", categoryId: "pmPZZSMH414dpolssCTM", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "YIW0sTwt7xf69hTupMr8", type: "depense", montant: 7.31, date: "2026-07-04", categoryId: "IKKiQOC7P6miKuSIea4O", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "YxkrUQKE02CrsNJTlnZR", type: "depense", montant: 200, date: "2026-07-05", categoryId: "Rx7kfnjV47VQ8t5lTPj8", subcategoryId: "jcjaGKimiNrB3dkTPEN7", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "fedFGuhp17g8PMDlza4q", type: "depense", montant: 200, date: "2026-07-04", categoryId: "Rx7kfnjV47VQ8t5lTPj8", subcategoryId: "jcjaGKimiNrB3dkTPEN7", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "phvAhBfKXVsX9Z0m5Vku", type: "depense", montant: 3.95, date: "2026-07-09", categoryId: "IKKiQOC7P6miKuSIea4O", categoryName: "", categorie: "", accountId: "acc-1" },
    { id: "uMLA1paKuD6yj7dS5N7d", type: "depense", montant: 8.78, date: "2026-07-10", categoryId: "H9APcDolF6UG1F2Yi2ta", categoryName: "", categorie: "", accountId: "acc-1" },
  ];

  const snapshot = buildAnalysisSnapshot({
    transactions: affectedTransactions,
    fixedExpenses: [],
    recurringIncome: [],
    categories: [
      { id: "pmPZZSMH414dpolssCTM", name: "Loisirs", type: "depense", isActive: true },
      { id: "IKKiQOC7P6miKuSIea4O", name: "Banque", type: "depense", isActive: true },
      { id: "Rx7kfnjV47VQ8t5lTPj8", name: "Transfert de compte", type: "depense", isActive: true },
      { id: "H9APcDolF6UG1F2Yi2ta", name: "Projet", type: "depense", isActive: true },
    ],
    subcategories: [
      { id: "jcjaGKimiNrB3dkTPEN7", name: "Revolut", categoryId: "Rx7kfnjV47VQ8t5lTPj8", type: "depense", isActive: true },
    ],
    range: current,
    previousRange: previous,
    accountId: "all",
    selectedCategory: "all",
  });

  const byCategory = new Map(snapshot.variableExpenses.segments.map((segment) => [segment.categoryName, segment]));

  assert.equal(snapshot.variableExpenses.total, 436.53999999999996);
  assert.equal(byCategory.has("Sans categorie"), false);
  assert.equal(byCategory.get("Loisirs").amount, 16.5);
  assert.equal(byCategory.get("Banque").amount, 11.26);
  assert.equal(byCategory.get("Transfert de compte").amount, 400);
  assert.equal(byCategory.get("Projet").amount, 8.78);
});

test("filterTransactionsByRangeAndAccount does not mutate input transactions", () => {
  const range = getPeriodRange("currentMonth", referenceDate);
  const sourceTransactions = [
    { id: "legacy-income", type: "income", montant: 10, date: "2026-07-06", accountId: "acc-1" },
  ];

  const filtered = filterTransactionsByRangeAndAccount(sourceTransactions, range, "all");

  assert.equal(sourceTransactions[0].type, "income");
  assert.notEqual(filtered[0], sourceTransactions[0]);
  assert.equal(filtered[0].type, "revenu");
});

test("legacy virement transactions are excluded from analysis filters", () => {
  const range = getPeriodRange("currentMonth", referenceDate);
  const sourceTransactions = [
    { id: "legacy-virement", type: "virement", montant: 100, date: "2026-07-06", accountId: "acc-1" },
    { id: "legacy-transfer", type: "transfer", montant: 80, date: "2026-07-07", accountId: "acc-1" },
    { id: "income", type: "revenu", montant: 50, date: "2026-07-08", accountId: "acc-1" },
  ];

  const filtered = filterTransactionsByRangeAndAccount(sourceTransactions, range, "all");

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "income");
});

test("groupRecurringIncomeBySource keeps two segments for same category with different names", () => {
  const sourceRows = [
    { sourceName: "Petsitting", categoryName: "Salaire", amount: 500 },
    { sourceName: "France Travail", categoryName: "Salaire", amount: 1100 },
  ];

  const grouped = groupRecurringIncomeBySource(sourceRows, 6);
  assert.equal(grouped.length, 2);

  const petsitting = grouped.find((item) => item.name === "Petsitting");
  const franceTravail = grouped.find((item) => item.name === "France Travail");

  assert.ok(petsitting);
  assert.ok(franceTravail);
  assert.equal(petsitting.amount, 500);
  assert.equal(franceTravail.amount, 1100);
  assert.equal(grouped.reduce((sum, item) => sum + item.amount, 0), 1600);
});

test("buildAnalysisSnapshot groups fixed income by source name", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);

  const snapshot = buildAnalysisSnapshot({
    transactions,
    fixedExpenses,
    recurringIncome: [
      {
        id: "inc-petsitting",
        isActive: true,
        name: "Petsitting",
        categoryName: "Salaire",
        accountId: "acc-1",
        frequency: "mensuel",
        initialAmount: 500,
        startDate: "2026-01-01",
      },
      {
        id: "inc-france-travail",
        isActive: true,
        name: "France Travail",
        categoryName: "Salaire",
        accountId: "acc-1",
        frequency: "mensuel",
        initialAmount: 1100,
        startDate: "2026-01-01",
      },
    ],
    range: current,
    previousRange: previous,
    accountId: "acc-1",
    selectedCategory: "all",
  });

  const petsitting = snapshot.fixedIncome.segments.find((item) => item.categoryName === "Petsitting");
  const franceTravail = snapshot.fixedIncome.segments.find((item) => item.categoryName === "France Travail");

  assert.ok(petsitting);
  assert.ok(franceTravail);
  assert.equal(petsitting.amount, 500);
  assert.equal(franceTravail.amount, 1100);
  assert.equal(snapshot.fixedIncome.total, 1600);
});

test("groupRecurringIncomeBySource does not mutate source rows", () => {
  const sourceRows = [
    { sourceName: "Petsitting", categoryName: "Salaire", amount: 500 },
    { sourceName: "France Travail", categoryName: "Salaire", amount: 1100 },
  ];
  const before = JSON.stringify(sourceRows);

  groupRecurringIncomeBySource(sourceRows, 6);

  assert.equal(JSON.stringify(sourceRows), before);
});

test("linked fixed expense uses the real transaction amount exactly once and falls back after deletion", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);
  const fixedExpense = {
    id: "fixed-edf",
    isActive: true,
    name: "EDF",
    categoryId: "energy",
    categoryName: "Energie",
    accountId: "acc-1",
    frequency: "monthly",
    initialAmount: 40,
    startDate: "2026-01-01",
  };
  const linkedTransaction = {
    id: "tx-edf",
    type: "depense",
    montant: 57.25,
    date: "2026-07-10",
    categoryId: "energy",
    categoryName: "Energie",
    accountId: "acc-1",
    fixedExpenseId: "fixed-edf",
  };

  const paid = buildAnalysisSnapshot({
    transactions: [linkedTransaction],
    fixedExpenses: [fixedExpense],
    range: current,
    previousRange: previous,
  });
  assert.equal(paid.fixedExpenses.total, 57.25);
  assert.equal(paid.variableExpenses.total, 0);
  assert.equal(paid.totals.expenses, 57.25);

  const modified = buildAnalysisSnapshot({
    transactions: [{ ...linkedTransaction, montant: 61 }],
    fixedExpenses: [fixedExpense],
    range: current,
    previousRange: previous,
  });
  assert.equal(modified.totals.expenses, 61);

  const afterDeletion = buildAnalysisSnapshot({
    transactions: [],
    fixedExpenses: [fixedExpense],
    range: current,
    previousRange: previous,
  });
  assert.equal(afterDeletion.fixedExpenses.total, 40);
  assert.equal(afterDeletion.variableExpenses.total, 0);
});
test("analysis keeps same-category fixed expenses distinct when subcategories conflict", () => {
  const current = getPeriodRange("currentMonth", referenceDate);
  const previous = getPreviousPeriodRange("currentMonth", referenceDate);
  const fixedExpense = {
    id: "fixed-electricity",
    isActive: true,
    name: "Electricite",
    categoryId: "housing",
    categoryName: "Logement",
    subcategoryId: "electricity",
    accountId: "acc-1",
    frequency: "monthly",
    initialAmount: 120,
    startDate: "2026-01-01",
  };
  const waterTransaction = {
    id: "tx-water",
    type: "depense",
    montant: 120,
    date: "2026-07-10",
    categoryId: "housing",
    categoryName: "Logement",
    subcategoryId: "water",
    accountId: "acc-1",
  };

  const snapshot = buildAnalysisSnapshot({
    transactions: [waterTransaction],
    fixedExpenses: [fixedExpense],
    range: current,
    previousRange: previous,
  });

  assert.equal(snapshot.fixedExpenses.total, 120);
  assert.equal(snapshot.variableExpenses.total, 120);
  assert.equal(snapshot.fixedExpenses.matchedTransactionsCount, 0);
  assert.equal(snapshot.totals.expenses, 240);
});
