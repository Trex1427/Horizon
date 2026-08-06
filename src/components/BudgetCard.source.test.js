import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/components/BudgetCard.jsx");

test("BudgetCard displays periodicity, spent, remaining, progress, and tracking mode", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("getBudgetPeriodicityLabel"), true);
  assert.equal(content.includes("getBudgetTrackingLabel"), true);
  assert.equal(content.includes("Consommé"), true);
  assert.equal(content.includes("Restant"), true);
  assert.equal(content.includes("statusLabel"), true);
  assert.equal(content.includes("periodicityLabel"), true);
  assert.equal(content.includes("trackingLabel"), true);
  assert.equal(content.includes("Progression du budget"), true);
});