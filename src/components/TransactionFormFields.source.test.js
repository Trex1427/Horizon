import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const fieldsPath = resolve(process.cwd(), "src/components/TransactionFormFields.jsx");

test("TransactionFormFields renders quick-create actions inside all transaction reference lists", async () => {
  const content = await readFile(fieldsPath, "utf8");

  assert.equal(content.includes('value={CREATE_CATEGORY_VALUE}'), true);
  assert.equal(content.includes('value={CREATE_THIRD_PARTY_VALUE}'), true);
  assert.equal(content.includes('value={CREATE_SUBCATEGORY_VALUE}'), true);
  assert.equal(content.includes('value={CREATE_ACTIVITY_VALUE}'), true);
  assert.equal(content.includes('value={CREATE_PROJECT_VALUE}'), true);
  assert.equal(content.includes('createOptionValue={CREATE_ACCOUNT_VALUE}'), true);
  assert.equal(content.includes('+ Créer une nouvelle catégorie'), true);
  assert.equal(content.includes('<MenuItem value="">Sans catégorie</MenuItem>'), true);
  assert.equal(content.includes('+ Créer un nouveau tiers'), true);
  assert.equal(content.includes('+ Créer une nouvelle sous-catégorie'), true);
  assert.equal(content.includes('+ Créer une nouvelle activité'), true);
  assert.equal(content.includes('+ Créer un nouveau projet'), true);
  assert.equal(content.includes('+ Créer un nouveau compte'), true);
  assert.equal(content.includes('aria-label="Créer un tiers"'), false);
  assert.equal(content.includes('aria-label="Créer une sous-catégorie"'), false);
  assert.equal(content.indexOf('{thirdParties.map((thirdParty) => (') < content.indexOf('+ Créer un nouveau tiers'), true);
  assert.equal(content.indexOf('{subcategoryOptions.map((subcategory) => (') < content.indexOf('+ Créer une nouvelle sous-catégorie'), true);
  assert.equal(content.includes('label="Frais fixe"'), true);
  assert.equal(content.includes('name="fixedExpenseId"'), true);
  assert.equal(content.includes('value={CREATE_FIXED_EXPENSE_VALUE}'), true);
  assert.equal(content.includes('+ Créer un nouveau frais fixe'), true);
  assert.equal(content.includes('form.type === "depense"'), true);
});
