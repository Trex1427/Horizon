import { getCanonicalCategoryId, getSubcategoriesForCanonicalCategory } from "./categorySelectionModel.js";

export function getFixedExpenseSubcategoryOptions(subcategories = [], categoryId = "", categoryReference = {}) {
  return getSubcategoriesForCanonicalCategory(subcategories, categoryId, categoryReference);
}

export function resetIncompatibleFixedExpenseSubcategory(formData = {}, nextCategoryId = "", subcategories = [], categoryReference = {}) {
  const canonicalCategoryId = getCanonicalCategoryId(categoryReference, nextCategoryId);
  const compatible = getFixedExpenseSubcategoryOptions(subcategories, canonicalCategoryId, categoryReference)
    .some((subcategory) => String(subcategory.id) === String(formData.subcategoryId || ""));

  return compatible
    ? { ...formData, categoryId: canonicalCategoryId }
    : { ...formData, categoryId: canonicalCategoryId, subcategoryId: "", subcategoryName: "" };
}