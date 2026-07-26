export function getFixedExpenseSubcategoryOptions(subcategories = [], categoryId = "") {
  if (!categoryId) return [];

  return subcategories.filter((subcategory) => (
    subcategory?.isActive !== false
    && String(subcategory?.categoryId || "") === String(categoryId)
  ));
}

export function resetIncompatibleFixedExpenseSubcategory(formData = {}, nextCategoryId = "", subcategories = []) {
  const compatible = getFixedExpenseSubcategoryOptions(subcategories, nextCategoryId)
    .some((subcategory) => String(subcategory.id) === String(formData.subcategoryId || ""));

  return compatible
    ? { ...formData, categoryId: nextCategoryId }
    : { ...formData, categoryId: nextCategoryId, subcategoryId: "", subcategoryName: "" };
}