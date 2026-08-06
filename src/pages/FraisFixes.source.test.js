import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "src/pages/FraisFixes.jsx");

test("FraisFixes exposes a dialog to view, add, and remove linked transactions", async () => {
  const content = await readFile(pagePath, "utf8");

  assert.equal(content.includes("useTransactions"), true);
  assert.equal(content.includes("linkedDialogOpen"), true);
  assert.equal(content.includes("Transactions liées"), true);
  assert.equal(content.includes("Ajouter une transaction"), true);
  assert.equal(content.includes("Impossible de retirer l'association."), true);
  assert.equal(content.includes("Recalculer les associations"), true);
  assert.equal(content.includes("Tableau de santé global"), true);
  assert.equal(content.includes("Indice de fiabilité"), true);
  assert.equal(content.includes("Timeline de réconciliation"), true);
  assert.equal(content.includes("Exporter le rapport d'audit"), true);
  assert.equal(content.includes("Garantie"), true);
  assert.equal(content.includes("TransactionUsageExplorer"), true);
  assert.equal(content.includes("Impossible de relancer la réconciliation."), true);
  assert.equal(content.includes("gridTemplateColumns"), true);
  assert.equal(content.includes("xl:"), true);
  assert.equal(content.includes("Prévision: {linkedExpenseReconciliation.forecastCount}"), true);
});
