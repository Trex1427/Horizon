import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appPath = resolve(process.cwd(), "src/App.jsx");
const transactionsPath = resolve(process.cwd(), "src/pages/Transactions.jsx");

test("App passes the transaction-opening callback into Budgets V2 and Fixed Expenses V2", async () => {
  const app = await readFile(appPath, "utf8");

  assert.equal(app.includes('<FixedExpensesV2 onNavigate={openDashboardV2Destination} onOpenTransactionsFiltered={openTransactionsWithContext} />'), true);
  assert.equal(app.includes('<BudgetsV2'), true);
  assert.equal(app.includes('accounts={accounts}'), true);
  assert.equal(app.includes('onOpenTransactionsFiltered={openTransactionsWithContext}'), true);
});

test("Transactions page reuses its editor when card explorers request a transaction", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('navigationContext.source !== "card-explorer"'), true);
  assert.equal(content.includes("navigationContext.openTransactionId"), true);
  assert.equal(content.includes('setMessage("Transaction ouverte depuis une carte ✅")'), true);
});