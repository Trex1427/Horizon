import test from "node:test";
import assert from "node:assert/strict";
import {
  applyTransactionsNavigationContext,
  buildChartSegment,
  buildTransactionsNavigationFilters,
  filterTransactionsForView,
  getDefaultTransactionSortPreferences,
  getDefaultTransactionsListFilters,
  getDetailActionLabel,
  getDetailCountLabel,
  sortTransactionsForView,
} from "./analysisInteractionUtils.js";

test("buildChartSegment builds detail payload without mutating source", () => {
  const source = {
    categoryId: "cat-food",
    categoryName: "Alimentation",
    amount: 642.35,
    percent: 28,
    transactionCount: 32,
    transactionIds: ["t1", "t2"],
  };

  const segment = buildChartSegment(source);

  assert.equal(segment.categoryId, "cat-food");
  assert.equal(segment.categoryName, "Alimentation");
  assert.equal(segment.amount, 642.35);
  assert.equal(segment.percentage, 28);
  assert.equal(segment.transactionCount, 32);
  assert.deepEqual(segment.transactionIds, ["t1", "t2"]);

  segment.transactionIds.push("t3");
  assert.deepEqual(source.transactionIds, ["t1", "t2"]);
});

test("buildChartSegment handles missing transactionIds and supports Autres", () => {
  const segment = buildChartSegment({
    name: "Autres",
    amount: 20,
    count: 4,
  });

  assert.equal(segment.categoryName, "Autres");
  assert.equal(segment.transactionCount, 4);
  assert.deepEqual(segment.transactionIds, []);
});

test("detail labels adapt for revenus and depenses", () => {
  const incomeSegment = buildChartSegment({ categoryName: "Salaire", transactionCount: 8, amount: 1000, percent: 50 });
  const expenseSegment = buildChartSegment({ categoryName: "Transport", transactionCount: 3, amount: 90, percent: 10 });
  const fixedSegment = buildChartSegment({ categoryName: "Loyer", itemCount: 2, transactionCount: 0, amount: 600, percent: 30 });

  assert.equal(getDetailCountLabel("income-variable", incomeSegment), "8 revenus");
  assert.equal(getDetailCountLabel("expense-variable", expenseSegment), "3 transactions");
  assert.equal(getDetailCountLabel("expense-fixed", fixedSegment), "2 postes");
  assert.equal(getDetailActionLabel("income-variable"), "Voir les revenus");
  assert.equal(getDetailActionLabel("expense-variable"), "Voir les transactions");
});

test("buildTransactionsNavigationFilters passes category, type, period and account", () => {
  const filters = buildTransactionsNavigationFilters({
    sectionType: "expense-variable",
    period: "last3Months",
    accountId: "acc-1",
    segment: {
      categoryId: "cat-food",
      categoryName: "Alimentation",
      amount: 10,
      percent: 20,
      transactionCount: 2,
      transactionIds: ["t1", "t2"],
    },
  });

  assert.equal(filters.type, "depense");
  assert.equal(filters.period, "last3Months");
  assert.equal(filters.accountId, "acc-1");
  assert.equal(filters.categoryId, "cat-food");
  assert.equal(filters.categoryName, "Alimentation");
  assert.deepEqual(filters.transactionIds, ["t1", "t2"]);
});

test("applyTransactionsNavigationContext maps analysis context and falls back to defaults", () => {
  const defaults = getDefaultTransactionsListFilters();

  const fromAnalysis = applyTransactionsNavigationContext({
    source: "analysis",
    period: "currentYear",
    type: "revenu",
    accountId: "acc-2",
    categoryId: "cat-income",
    categoryName: "Salaire",
    transactionIds: ["tx-1"],
  });

  assert.equal(fromAnalysis.period, "currentYear");
  assert.equal(fromAnalysis.type, "revenu");
  assert.equal(fromAnalysis.accountId, "acc-2");
  assert.equal(fromAnalysis.categoryId, "cat-income");
  assert.equal(fromAnalysis.categoryName, "Salaire");
  assert.equal(fromAnalysis.searchText, "");
  assert.deepEqual(fromAnalysis.transactionIds, ["tx-1"]);
  assert.equal(fromAnalysis.subcategoryId, "all");
  assert.equal(fromAnalysis.activityId, "all");
  assert.equal(fromAnalysis.thirdPartyId, "all");
  assert.equal(fromAnalysis.projectId, "all");

  const ignored = applyTransactionsNavigationContext({ source: "manual" });
  assert.deepEqual(ignored, defaults);
});

test("getDefaultTransactionSortPreferences returns expected date desc defaults", () => {
  assert.deepEqual(getDefaultTransactionSortPreferences(), {
    field: "date",
    direction: "desc",
  });
});

test("getDefaultTransactionsListFilters defaults to current year", () => {
  const defaults = getDefaultTransactionsListFilters();

  assert.equal(defaults.period, "currentYear");
  assert.equal(defaults.type, "all");
  assert.equal(defaults.accountId, "all");
});

test("filterTransactionsForView applies navigation filters and transactionIds", () => {
  const transactions = [
    { id: "t1", type: "depense", montant: 10, date: "2026-07-02", accountId: "acc-1", categoryId: "cat-food", categoryName: "Alimentation" },
    { id: "t2", type: "depense", montant: 20, date: "2026-07-03", accountId: "acc-1", categoryId: "cat-food", categoryName: "Alimentation" },
    { id: "t3", type: "revenu", montant: 30, date: "2026-07-04", accountId: "acc-1", categoryId: "cat-salary", categoryName: "Salaire" },
    { id: "t4", type: "depense", montant: 40, date: "2026-06-04", accountId: "acc-1", categoryId: "cat-food", categoryName: "Alimentation" },
  ];

  const filtered = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "depense",
    accountId: "acc-1",
    categoryId: "cat-food",
    categoryName: "Alimentation",
    transactionIds: ["t2"],
  }, new Date("2026-07-15T10:00:00Z"));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "t2");
});

test("filterTransactionsForView combines text search with other filters", () => {
  const transactions = [
    { id: "a", type: "depense", montant: 10, date: "2026-07-01", accountId: "acc-1", categoryName: "Alimentation", description: "Carrefour" },
    { id: "b", type: "depense", montant: 12, date: "2026-07-02", accountId: "acc-1", categoryName: "Transport", description: "Uber" },
    { id: "c", type: "revenu", montant: 3500, date: "2026-07-03", accountId: "acc-2", categoryName: "Salaire", description: "Paie" },
  ];

  const filtered = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "depense",
    accountId: "acc-1",
    categoryId: "all",
    categoryName: "all",
    searchText: "uber",
    transactionIds: [],
  }, new Date("2026-07-15T10:00:00Z"));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "b");
});

test("filterTransactionsForView combines new reference filters", () => {
  const transactions = [
    {
      id: "tx-1",
      type: "depense",
      montant: 60,
      date: "2026-07-05",
      accountId: "acc-1",
      categoryId: "cat-transport",
      categoryName: "Transport",
      subcategoryId: "sub-carburant",
      subcategoryName: "Carburant",
      activityId: "act-auto",
      activityName: "Auto-entreprise",
      thirdPartyId: "tp-total",
      thirdPartyName: "TotalEnergies",
      projectId: "proj-monod",
      projectName: "Chantier Monod",
      description: "Plein",
    },
    {
      id: "tx-2",
      type: "depense",
      montant: 20,
      date: "2026-07-06",
      accountId: "acc-1",
      categoryId: "cat-transport",
      categoryName: "Transport",
      subcategoryId: "sub-peage",
      subcategoryName: "Peage",
      activityId: "act-auto",
      activityName: "Auto-entreprise",
      thirdPartyId: "tp-vinci",
      thirdPartyName: "VINCI",
      projectId: "proj-monod",
      projectName: "Chantier Monod",
      description: "Autoroute",
    },
  ];

  const filtered = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "depense",
    accountId: "acc-1",
    categoryId: "cat-transport",
    categoryName: "Transport",
    subcategoryId: "sub-carburant",
    activityId: "act-auto",
    thirdPartyId: "tp-total",
    projectId: "proj-monod",
    searchText: "",
    transactionIds: [],
  }, new Date("2026-07-20T10:00:00Z"));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "tx-1");
});

test("filterTransactionsForView text search covers tiers activite projet et sous-categorie", () => {
  const transactions = [
    {
      id: "tx-1",
      type: "depense",
      montant: 60,
      date: "2026-07-05",
      accountId: "acc-1",
      categoryName: "Transport",
      subcategoryName: "Carburant",
      activityName: "Auto-entreprise",
      thirdPartyName: "TotalEnergies",
      projectName: "Chantier Monod",
      description: "Plein",
    },
  ];

  const fromThirdParty = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "all",
    accountId: "all",
    categoryId: "all",
    categoryName: "all",
    subcategoryId: "all",
    activityId: "all",
    thirdPartyId: "all",
    projectId: "all",
    searchText: "total",
    transactionIds: [],
  }, new Date("2026-07-20T10:00:00Z"));

  const fromProject = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "all",
    accountId: "all",
    categoryId: "all",
    categoryName: "all",
    subcategoryId: "all",
    activityId: "all",
    thirdPartyId: "all",
    projectId: "all",
    searchText: "monod",
    transactionIds: [],
  }, new Date("2026-07-20T10:00:00Z"));

  assert.equal(fromThirdParty.length, 1);
  assert.equal(fromProject.length, 1);
});

test("sortTransactionsForView sorts by requested fields and direction", () => {
  const transactions = [
    { id: "t1", type: "depense", montant: 30, date: "2026-07-01", accountId: "acc-1", categoryName: "Transport", description: "Taxi" },
    { id: "t2", type: "revenu", montant: 100, date: "2026-07-03", accountId: "acc-2", categoryName: "Salaire", description: "Paie" },
    { id: "t3", type: "depense", montant: 10, date: "2026-07-02", accountId: "acc-3", categoryName: "Alimentation", description: "Courses" },
  ];

  const amountAsc = sortTransactionsForView(transactions, { field: "amount", direction: "asc" });
  assert.deepEqual(amountAsc.map((transaction) => transaction.id), ["t3", "t1", "t2"]);

  const descriptionDesc = sortTransactionsForView(transactions, { field: "description", direction: "desc" });
  assert.deepEqual(descriptionDesc.map((transaction) => transaction.id), ["t1", "t2", "t3"]);

  const accountAsc = sortTransactionsForView(
    transactions,
    { field: "account", direction: "asc" },
    { getAccountLabel: (accountId) => ({ "acc-1": "Compte B", "acc-2": "Compte C", "acc-3": "Compte A" }[accountId] || accountId) }
  );
  assert.deepEqual(accountAsc.map((transaction) => transaction.id), ["t3", "t1", "t2"]);

  const dateAsc = sortTransactionsForView(transactions, { field: "date", direction: "asc" });
  assert.deepEqual(dateAsc.map((transaction) => transaction.id), ["t1", "t3", "t2"]);

  const dateDesc = sortTransactionsForView(transactions, { field: "date", direction: "desc" });
  assert.deepEqual(dateDesc.map((transaction) => transaction.id), ["t2", "t3", "t1"]);

  const amountDesc = sortTransactionsForView(transactions, { field: "amount", direction: "desc" });
  assert.deepEqual(amountDesc.map((transaction) => transaction.id), ["t2", "t1", "t3"]);

  const descriptionAsc = sortTransactionsForView(transactions, { field: "description", direction: "asc" });
  assert.deepEqual(descriptionAsc.map((transaction) => transaction.id), ["t3", "t2", "t1"]);

  const categoryAsc = sortTransactionsForView(transactions, { field: "category", direction: "asc" });
  assert.deepEqual(categoryAsc.map((transaction) => transaction.id), ["t3", "t2", "t1"]);

  const typeAsc = sortTransactionsForView(transactions, { field: "type", direction: "asc" });
  assert.deepEqual(typeAsc.map((transaction) => transaction.id), ["t3", "t1", "t2"]);
});

test("sortTransactionsForView does not mutate source array", () => {
  const transactions = [
    { id: "t1", date: "2026-07-01", montant: 30, description: "Taxi", categoryName: "Transport", accountId: "acc-1", type: "depense" },
    { id: "t2", date: "2026-07-03", montant: 100, description: "Paie", categoryName: "Salaire", accountId: "acc-2", type: "revenu" },
    { id: "t3", date: "2026-07-02", montant: 10, description: "Courses", categoryName: "Alimentation", accountId: "acc-3", type: "depense" },
  ];
  const originalOrder = transactions.map((transaction) => transaction.id);

  const sorted = sortTransactionsForView(transactions, { field: "amount", direction: "asc" });

  assert.deepEqual(sorted.map((transaction) => transaction.id), ["t3", "t1", "t2"]);
  assert.deepEqual(transactions.map((transaction) => transaction.id), originalOrder);
});

test("filter and sort remain fluid with more than 500 transactions", () => {
  const transactions = Array.from({ length: 650 }, (_, index) => {
    const day = String((index % 28) + 1).padStart(2, "0");
    return {
      id: `tx-${index}`,
      type: index % 5 === 0 ? "revenu" : "depense",
      montant: (index % 200) + 0.5,
      date: `2026-07-${day}`,
      accountId: index % 2 === 0 ? "acc-1" : "acc-2",
      categoryName: index % 3 === 0 ? "Alimentation" : "Transport",
      description: index % 7 === 0 ? `Uber ${index}` : `Transaction ${index}`,
    };
  });

  const start = process.hrtime.bigint();
  const filtered = filterTransactionsForView(transactions, {
    period: "currentMonth",
    type: "depense",
    accountId: "acc-2",
    categoryId: "all",
    categoryName: "Transport",
    searchText: "transaction",
    transactionIds: [],
  }, new Date("2026-07-20T10:00:00Z"));
  const sorted = sortTransactionsForView(filtered, { field: "date", direction: "desc" });
  const elapsedMs = Number(process.hrtime.bigint() - start) / 1_000_000;

  assert.ok(filtered.length > 0);
  assert.equal(sorted.length, filtered.length);
  assert.ok(elapsedMs < 200, `Filtering and sorting should stay fluid for >500 rows (actual: ${elapsedMs.toFixed(2)}ms)`);
});
