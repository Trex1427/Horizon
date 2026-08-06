import { getCanonicalCategoryId, getSubcategoriesForCanonicalCategory } from "./categorySelectionModel.js";

export function getBudgetSubcategoryOptions(subcategories = [], categoryId = "", categoryReference = {}) {
  return getSubcategoriesForCanonicalCategory(subcategories, categoryId, categoryReference);
}

export function resetIncompatibleBudgetSubcategory(formData = {}, nextCategoryId = "", subcategories = [], categoryReference = {}) {
  const canonicalCategoryId = getCanonicalCategoryId(categoryReference, nextCategoryId);
  const compatibleSubcategories = getSubcategoriesForCanonicalCategory(subcategories, canonicalCategoryId, categoryReference);
  const selectedSubcategory = compatibleSubcategories.find((subcategory) => subcategory?.id === formData.subcategoryId);

  return selectedSubcategory
    ? { ...formData, categoryId: canonicalCategoryId }
    : { ...formData, categoryId: canonicalCategoryId, subcategoryId: "", subcategoryName: "" };
}
