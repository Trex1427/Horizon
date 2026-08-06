import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/components/FixedExpenseCard.jsx");

test("FixedExpenseCard exposes a linked-transactions menu action", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("Voir le détail"), true);
  assert.equal(content.includes("onViewTransactions"), true);
  assert.equal(content.includes("Prochaine échéance"), true);
  assert.equal(content.includes("transaction(s) suivie(s)"), true);
  assert.equal(content.includes("guaranteeLines[0]"), true);
  assert.equal(content.includes("synchronizationRatio"), true);
  assert.equal(content.includes("onOpenClick={() => onViewTransactions?.(fixedExpense)}"), true);
});
