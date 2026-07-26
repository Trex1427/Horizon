import test from "node:test";
import assert from "node:assert/strict";
import { getBudgetSubcategoryOptions, resetIncompatibleBudgetSubcategory } from "./budgetFormUtils.js";

const subcategories = [
  { id: "rent", name: "Loyer", categoryId: "housing", isActive: true },
  { id: "electricity", name: "Electricite", categoryId: "housing", isActive: true },
  { id: "fuel", name: "Carburant", categoryId: "transport", isActive: true },
  { id: "inactive", name: "Ancienne", categoryId: "housing", isActive: false },
];

test("budget subcategory options contain only active children of selected category", () => {
  assert.deepEqual(getBudgetSubcategoryOptions(subcategories, "housing").map((item) => item.id), ["electricity", "rent"]);
  assert.deepEqual(getBudgetSubcategoryOptions(subcategories, "transport").map((item) => item.id), ["fuel"]);
});

test("changing category clears an incompatible budget subcategory", () => {
  const result = resetIncompatibleBudgetSubcategory({
    categoryId: "housing", subcategoryId: "electricity", subcategoryName: "Electricite",
  }, "transport", subcategories);
  assert.equal(result.categoryId, "transport");
  assert.equal(result.subcategoryId, "");
  assert.equal(result.subcategoryName, "");
});

test("editing keeps a compatible selected subcategory", () => {
  const result = resetIncompatibleBudgetSubcategory({
    categoryId: "housing", subcategoryId: "electricity", subcategoryName: "Electricite",
  }, "housing", subcategories);
  assert.equal(result.subcategoryId, "electricity");
});
