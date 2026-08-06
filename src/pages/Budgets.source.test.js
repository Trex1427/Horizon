import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "src/pages/Budgets.jsx");

test("Budgets opens the shared transaction explorer from cards with transaction actions", async () => {
  const content = await readFile(pagePath, "utf8");

  assert.equal(content.includes("TransactionUsageExplorer"), true);
  assert.equal(content.includes("buildBudgetExplorerRows"), true);
  assert.equal(content.includes("onOpenDetails={handleOpenBudgetExplorer}"), true);
  assert.equal(content.includes("Montant prévu"), true);
  assert.equal(content.includes("Montant consommé"), true);
  assert.equal(content.includes("Montant restant"), true);
  assert.equal(content.includes("Progression"), true);
  assert.equal(content.includes("Supprimer cette transaction ?"), true);
});

test("Budgets page keeps responsive budget management with configurable periodicity", async () => {
  const content = await readFile(pagePath, "utf8");

  assert.equal(content.includes("calculateBudgetMetrics"), true);
  assert.equal(content.includes("BudgetForm"), true);
  assert.equal(content.includes("enableDesktopDoubleClickEdit"), true);
});