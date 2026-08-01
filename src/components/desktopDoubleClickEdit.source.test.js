import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";


async function source(path) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

test("editable finance pages enable the shared Desktop double-click convention", async () => {
  const pages = await Promise.all([
    "src/pages/Categories.jsx",
    "src/pages/FraisFixes.jsx",
    "src/pages/Budgets.jsx",
    "src/pages/Objectifs.jsx",
  ].map(source));

  for (const content of pages) {
    assert.match(content, /useMediaQuery\("\(min-width:900px\)"\)/);
    assert.match(content, /enableDoubleClickEdit=\{enableDesktopDoubleClickEdit\}/);
  }
});

test("editable cards reuse their existing edit callback on Desktop double-click", async () => {
  const [category, fixedExpense, budget, objective] = await Promise.all([
    source("src/components/CategoryCard.jsx"),
    source("src/components/FixedExpenseCard.jsx"),
    source("src/components/BudgetCard.jsx"),
    source("src/components/ObjectiveCard.jsx"),
  ]);

  assert.match(category, /if \(enableDoubleClickEdit\) handleEdit\(\)/);
  assert.match(category, /onDoubleClick=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(fixedExpense, /onEditClick=\{\(\) => onEdit\(fixedExpense\)\}/);
  assert.match(budget, /onEditClick=\{\(\) => onEdit\(budget\)\}/);
  assert.match(objective, /onEditClick=\{handleEditClick\}/);
});

test("reference and transfer rows ignore double-clicks from internal controls", async () => {
  const [references, transactions] = await Promise.all([
    source("src/pages/Referentiels.jsx"),
    source("src/pages/Transactions.jsx"),
  ]);

  const protectedTarget = "event.target.closest(\"button, a, input, textarea, select, [role='button']\")";
  assert.equal(references.includes(protectedTarget), true);
  assert.equal(transactions.includes(protectedTarget), true);
  assert.match(references, /editableRowProps=\{editableRowProps\}/);
  assert.match(references, /setSubcategoryForm/);
  assert.match(references, /setActivityForm/);
  assert.match(references, /setThirdPartyForm/);
  assert.match(references, /setProjectForm/);
  assert.match(transactions, /openEditTransferDialog\(transfer\)/);
});
