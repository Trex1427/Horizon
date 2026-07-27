import test from "node:test";
import assert from "node:assert/strict";
import { filterTransactionsForView } from "./analysisInteractionUtils.js";
import { resolveVisibleSelectedTransactionIds, resolveVisibleSelectedTransactions } from "./transactionSelection.js";

const transactions = [
  { id: "jan-food-a", date: "2026-01-05", type: "depense", accountId: "main", categoryId: "food", categoryName: "Alimentation", description: "Marché", montant: 20 },
  { id: "jan-food-b", date: "2026-01-12", type: "depense", accountId: "main", categoryId: "food", categoryName: "Alimentation", description: "Supermarché", montant: 40 },
  { id: "feb-food", date: "2026-02-05", type: "depense", accountId: "card", categoryId: "food", categoryName: "Alimentation", description: "Épicerie", montant: 30 },
  { id: "feb-legacy", date: "2026-02-10", type: "depense", accountId: "main", categoryName: "Transport", description: "Train", montant: 60 },
];

test("one selected visible transaction resolves from its id", () => {
  assert.deepEqual(resolveVisibleSelectedTransactionIds(["jan-food-a"], transactions), ["jan-food-a"]);
});

test("multiple selected visible transactions keep stable unique ids", () => {
  assert.deepEqual(resolveVisibleSelectedTransactionIds(["jan-food-a", "jan-food-b", "jan-food-a"], transactions), ["jan-food-a", "jan-food-b"]);
});

test("partial selection in a populated category targets only selected rows", () => {
  assert.deepEqual(resolveVisibleSelectedTransactions(["jan-food-a"], transactions).map((transaction) => transaction.id), ["jan-food-a"]);
});

test("annual, monthly, account and search views exclude invisible selected ids", () => {
  const referenceDate = new Date(2026, 1, 15);
  const annual = filterTransactionsForView(transactions, { period: "currentYear" }, referenceDate);
  const month = filterTransactionsForView(transactions, { period: "currentMonth" }, referenceDate);
  const account = filterTransactionsForView(transactions, { period: "currentYear", accountId: "main" }, referenceDate);
  const search = annual.filter((transaction) => transaction.description.toLowerCase().includes("train"));
  const selectedIds = transactions.map((transaction) => transaction.id);

  assert.equal(resolveVisibleSelectedTransactionIds(selectedIds, annual).length, 4);
  assert.deepEqual(resolveVisibleSelectedTransactionIds(selectedIds, month), ["feb-food", "feb-legacy"]);
  assert.deepEqual(resolveVisibleSelectedTransactionIds(selectedIds, account), ["jan-food-a", "jan-food-b", "feb-legacy"]);
  assert.deepEqual(resolveVisibleSelectedTransactionIds(selectedIds, search), ["feb-legacy"]);
});

test("changing a filter removes hidden selections and returning does not resurrect them", () => {
  const februaryView = transactions.filter((transaction) => transaction.date.startsWith("2026-02"));
  const prunedIds = resolveVisibleSelectedTransactionIds(["jan-food-a", "feb-food"], februaryView);
  assert.deepEqual(prunedIds, ["feb-food"]);
  assert.deepEqual(resolveVisibleSelectedTransactionIds(prunedIds, transactions), ["feb-food"]);
});

test("empty selection and empty displayed view stay empty", () => {
  assert.deepEqual(resolveVisibleSelectedTransactionIds([], transactions), []);
  assert.deepEqual(resolveVisibleSelectedTransactionIds(["jan-food-a"], []), []);
});

test("selection supports canonical, legacy and multiple-account records without object identity", () => {
  const clonedView = transactions.map((transaction) => ({ ...transaction }));
  const selected = resolveVisibleSelectedTransactions(["feb-legacy", "feb-food"], clonedView);
  assert.deepEqual(selected.map((transaction) => transaction.id), ["feb-food", "feb-legacy"]);
  assert.notEqual(selected[0], transactions[2]);
});
