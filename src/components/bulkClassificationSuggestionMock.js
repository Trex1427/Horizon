const MOCK_BULK_CLASSIFICATION_SUGGESTION = {
  sourceLabel: "CARREFOUR VITROLLES",
  categoryName: "Alimentation",
};

export function getMockBulkClassificationSuggestion(categories = []) {
  const matchedCategory = categories.find((category) => {
    const categoryName = String(category?.name || "").trim().toLowerCase();
    return categoryName === MOCK_BULK_CLASSIFICATION_SUGGESTION.categoryName.toLowerCase() && category?.isActive !== false;
  });

  return {
    ...MOCK_BULK_CLASSIFICATION_SUGGESTION,
    categoryId: matchedCategory?.id || "",
  };
}