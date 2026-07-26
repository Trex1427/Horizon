import test from "node:test";
import assert from "node:assert/strict";
import {
  getFixedExpenseSubcategoryOptions,
  resetIncompatibleFixedExpenseSubcategory,
} from "./fixedExpenseFormUtils.js";

const subcategories = [
  { id: "electricity", name: "Électricité", categoryId: "housing", isActive: true },
  { id: "rent", name: "Loyer", categoryId: "housing", isActive: true },
  { id: "fuel", name: "Carburant", categoryId: "transport", isActive: true },
  { id: "old", name: "Ancienne", categoryId: "housing", isActive: false },
];

test("fixed expense subcategory options keep only active children of selected category", () => {
  assert.deepEqual(
    getFixedExpenseSubcategoryOptions(subcategories, "housing").map((item) => item.id),
    ["electricity", "rent"]
  );
});

test("changing fixed expense category clears an incompatible subcategory", () => {
  const result = resetIncompatibleFixedExpenseSubcategory(
    { categoryId: "housing", subcategoryId: "electricity", subcategoryName: "Électricité" },
    "transport",
    subcategories
  );
  assert.equal(result.categoryId, "transport");
  assert.equal(result.subcategoryId, "");
  assert.equal(result.subcategoryName, "");
});

test("editing keeps a compatible fixed expense subcategory", () => {
  const result = resetIncompatibleFixedExpenseSubcategory(
    { categoryId: "housing", subcategoryId: "electricity", subcategoryName: "Électricité" },
    "housing",
    subcategories
  );
  assert.equal(result.subcategoryId, "electricity");
});