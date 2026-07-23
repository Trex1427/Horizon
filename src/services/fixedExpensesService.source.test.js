import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("fixed-expense creation checks compatible active documents and uses an atomic stable id", async () => {
  const content = await readFile(resolve(process.cwd(), "src/services/fixedExpensesService.js"), "utf8");

  assert.equal(content.includes("areFixedExpensesCompatible"), true);
  assert.equal(content.includes("buildFixedExpenseDocumentId"), true);
  assert.equal(content.includes("await runTransaction"), true);
  assert.equal(content.includes('error.code = "fixed-expense/already-exists"'), true);
  assert.equal(content.includes("addDoc"), false);
});

test("fixed-expense hook and quick-create dialog both guard repeated submission", async () => {
  const hook = await readFile(resolve(process.cwd(), "src/hooks/useFixedExpenses.js"), "utf8");
  const page = await readFile(resolve(process.cwd(), "src/pages/Transactions.jsx"), "utf8");

  assert.equal(hook.includes("createSubmittingRef.current"), true);
  assert.equal(page.includes("quickFixedExpenseSubmittingRef.current"), true);
  assert.equal(page.includes("submitting={quickFixedExpenseSubmitting}"), true);
});
