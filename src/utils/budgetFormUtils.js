export function getBudgetSubcategoryOptions(subcategories = [], categoryId = "") {
  return (subcategories || [])
    .filter((subcategory) => subcategory?.isActive !== false)
    .filter((subcategory) => String(subcategory?.categoryId || "") === String(categoryId || ""))
    .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "fr", { sensitivity: "base" }));
}

export function resetIncompatibleBudgetSubcategory(formData = {}, nextCategoryId = "", subcategories = []) {
  const selectedSubcategory = (subcategories || []).find((subcategory) => (
    subcategory?.id === formData.subcategoryId
    && subcategory?.isActive !== false
    && String(subcategory?.categoryId || "") === String(nextCategoryId || "")
  ));

  return selectedSubcategory
    ? { ...formData, categoryId: nextCategoryId }
    : { ...formData, categoryId: nextCategoryId, subcategoryId: "", subcategoryName: "" };
}
