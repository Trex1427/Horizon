/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("FraisFixes passes active subcategory references to the visible form", async () => {
  const page = await read("src/pages/FraisFixes.jsx");
  const form = await read("src/components/FixedExpenseForm.jsx");
  assert.equal(page.includes("useSubcategories()"), true);
  assert.equal(page.includes("subcategories={subcategories}"), true);
  assert.equal(form.includes('label="Sous-catégorie (optionnelle)"'), true);
  assert.equal(form.includes('name="subcategoryId"'), true);
  assert.equal(form.includes('subcategoryId: initialExpense.subcategoryId || ""'), true);
  assert.equal(form.includes("resetIncompatibleFixedExpenseSubcategory"), true);
});

test("fixed expense form exposes service errors and prevents repeated submit", async () => {
  const form = await read("src/components/FixedExpenseForm.jsx");
  assert.equal(form.includes('errors.submit && <Alert severity="error">'), true);
  assert.equal(form.includes("submitting={isLoading || submitting}"), true);
});

test("fixed expense list distinguishes category and subcategory", async () => {
  const card = await read("src/components/FixedExpenseCard.jsx");
  assert.equal(card.includes("fixedExpense.subcategoryName"), true);
  assert.equal(card.includes("·"), true);
});
test("fixed expense service persists optional subcategory fields on create and update", async () => {
  const service = await read("src/services/fixedExpensesService.js");
  assert.equal((service.match(/subcategoryId: safePayload\.subcategoryId \|\| null/g) || []).length, 2);
  assert.equal((service.match(/subcategoryName: safePayload\.subcategoryId/g) || []).length, 2);
});