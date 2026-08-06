import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const budgetFormPath = resolve(process.cwd(), "src/components/BudgetForm.jsx");

test("BudgetForm guards repeated submissions until the current write finishes", async () => {
  const content = await readFile(budgetFormPath, "utf8");

  assert.equal(content.includes("const submissionInFlightRef = useRef(false)"), true);
  assert.equal(content.includes("submissionInFlightRef.current || isLoading || !validate()"), true);
  assert.equal(content.includes("submissionInFlightRef.current = true"), true);
  assert.equal(content.includes("submissionInFlightRef.current = false"), true);
  assert.equal(content.includes("{isLoading || isSubmitting ? \"Enregistrement...\""), true);
});

test("BudgetForm uses the same canonical category per visible name as Transactions", async () => {
  const content = await readFile(budgetFormPath, "utf8");

  assert.equal(content.includes("const categoryOptions = useMemo"), true);
  assert.equal(content.includes("buildExpenseCategoryReference"), true);
  assert.equal(content.includes("getCanonicalCategoryId"), true);
  assert.equal(content.includes("categoryOptions.find((category) => category.id === formData.categoryId)"), true);
});
test("BudgetForm exposes optional filtered subcategory selection and edit persistence", async () => {
  const content = await readFile(budgetFormPath, "utf8");
  assert.equal(content.includes('label="Sous-catégorie"'), true);
  assert.equal(content.includes('name="subcategoryId"'), true);
  assert.equal(content.includes('subcategoryId: initialBudget.subcategoryId || ""'), true);
  assert.equal(content.includes('subcategoryId: selectedSubcategory?.id || null'), true);
  assert.equal(content.includes("resetIncompatibleBudgetSubcategory"), true);
  assert.equal(content.includes('errors.submit ? <ErrorState'), true);
});

test("BudgetForm exposes configurable periodicity and rolling tracking controls", async () => {
  const content = await readFile(budgetFormPath, "utf8");

  assert.equal(content.includes("PERIODICITY_OPTIONS"), true);
  assert.equal(content.includes('label="Périodicité"'), true);
  assert.equal(content.includes('value: "monthly"'), true);
  assert.equal(content.includes('value: "quarterly"'), true);
  assert.equal(content.includes('value: "semiAnnual"'), true);
  assert.equal(content.includes('value: "annual"'), true);
  assert.equal(content.includes('value: "custom"'), true);
  assert.equal(content.includes('label="Type"'), true);
  assert.equal(content.includes('Période glissante'), true);
  assert.equal(content.includes('formData.periodicity === "custom"'), true);
  assert.equal(content.includes('label="Fin"'), true);
});
