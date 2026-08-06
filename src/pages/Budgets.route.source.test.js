import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const source = (relativePath) => readFile(resolve(process.cwd(), relativePath), "utf8");

test("App renders the Budgets page that mounts the subcategory-enabled BudgetForm", async () => {
  const [app, page, form] = await Promise.all([
    source("src/App.jsx"),
    source("src/pages/Budgets.jsx"),
    source("src/components/BudgetForm.jsx"),
  ]);

  assert.equal(app.includes('const Budgets = lazy(() => import("./pages/Budgets"))'), true);
  assert.equal(app.includes("page === PAGES.BUDGETS"), true);
  assert.equal(app.includes("onOpenTransactionsFiltered={openTransactionsWithContext}"), true);
  assert.equal(page.includes('import { BudgetForm } from "../components/BudgetForm"'), true);
  assert.equal(page.includes("const { subcategories } = useSubcategories()"), true);
  assert.equal(page.includes("subcategories={subcategories}"), true);
  assert.equal(form.includes('label="Sous-catégorie"'), true);
  assert.equal(form.includes('name="subcategoryId"'), true);
});
