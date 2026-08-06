import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBudgetExplorerRows,
  buildFixedExpenseExplorerRows,
  buildTransactionUsageTotals,
  filterTransactionUsageRows,
  sortTransactionUsageRows,
} from "./transactionUsageExplorerModel.js";

const accounts = [{ id: "acc-1", name: "Compte courant" }];

test("buildBudgetExplorerRows keeps only matching budget transactions", () => {
  const rows = buildBudgetExplorerRows(
    { categoryId: "cat-food", categoryName: "Alimentation", startDate: "2026-01-01", endDate: "2026-01-31", accountId: "acc-1" },
    [
      { id: "tx-1", type: "depense", categoryId: "cat-food", accountId: "acc-1", date: "2026-01-10", montant: 20, description: "Courses", thirdPartyName: "Marché" },
      { id: "tx-2", type: "depense", categoryId: "cat-rent", accountId: "acc-1", date: "2026-01-10", montant: 30, description: "Loyer" },
    ],
    accounts
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].description, "Courses");
  assert.equal(rows[0].account, "Compte courant");
});

test("buildFixedExpenseExplorerRows exposes anomaly and replaced-forecast statuses", () => {
  const rows = buildFixedExpenseExplorerRows({
    occurrences: [
      {
        id: "occ-1",
        state: "transaction",
        fixedExpense: { categoryName: "Télécom" },
        transactions: [{ transaction: { id: "tx-1", date: "2026-01-05", montant: 29, accountId: "acc-1", description: "Orange" } }],
      },
      {
        id: "occ-2",
        state: "anomaly",
        fixedExpense: { categoryName: "Assurance" },
        transactions: [
          { transaction: { id: "tx-2", date: "2026-02-05", montant: 42, accountId: "acc-1", description: "Assurance 1" } },
          { transaction: { id: "tx-3", date: "2026-02-06", montant: 42, accountId: "acc-1", description: "Assurance 2" } },
        ],
      },
    ],
  }, accounts);

  assert.equal(rows[0].statusLabel, "Prévision remplacée");
  assert.equal(rows[1].statusLabel, "⚠ Anomalie");
  assert.equal(rows[2].statusLabel, "⚠ Anomalie");
});

test("filterTransactionUsageRows supports search, account, date and amount", () => {
  const rows = [
    { id: "a", description: "Orange", account: "Compte courant", category: "Télécom", thirdParty: "Orange", amount: 29, date: "2026-01-05" },
    { id: "b", description: "Loyer", account: "Épargne", category: "Logement", thirdParty: "Bailleur", amount: 420, date: "2026-02-05" },
  ];

  const filtered = filterTransactionUsageRows(rows, {
    searchText: "orange",
    account: "Compte courant",
    fromDate: "2026-01-01",
    toDate: "2026-01-31",
    minAmount: "20",
    maxAmount: "30",
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "a");
});

test("sortTransactionUsageRows sorts by amount and date", () => {
  const rows = [
    { id: "a", amount: 20, date: "2026-01-03", description: "A" },
    { id: "b", amount: 30, date: "2026-01-01", description: "B" },
  ];

  assert.equal(sortTransactionUsageRows(rows, { field: "amount", direction: "desc" })[0].id, "b");
  assert.equal(sortTransactionUsageRows(rows, { field: "date", direction: "asc" })[0].id, "b");
});

test("buildTransactionUsageTotals returns count and amount", () => {
  const totals = buildTransactionUsageTotals([{ amount: 20 }, { amount: 30 }]);
  assert.equal(totals.count, 2);
  assert.equal(totals.totalAmount, 50);
});