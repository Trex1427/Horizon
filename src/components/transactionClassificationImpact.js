import {
  getTransactionCategoryName,
  isTransactionMatchingBudgetCategory,
  normalizeCategoryName,
} from "../services/financeCalculations.js";

const DEFAULT_UNCATEGORIZED_LABEL = "Sans catégorie";

function normalizeId(value) {
  return String(value || "").trim();
}

function isUncategorizedName(value) {
  const normalized = normalizeCategoryName(value || "");
  return normalized === "sans catégorie" || normalized === "sans categorie";
}

function resolveSnapshotCategoryLabel(transaction = {}, categoryById = new Map()) {
  const hasCategoryIdField = Object.prototype.hasOwnProperty.call(transaction || {}, "categoryId");
  const normalizedCategoryId = normalizeId(transaction?.categoryId);

  if (hasCategoryIdField && !normalizedCategoryId) {
    return DEFAULT_UNCATEGORIZED_LABEL;
  }

  const labelFromCatalog = normalizedCategoryId ? categoryById.get(normalizedCategoryId)?.name : "";
  const legacyLabel = getTransactionCategoryName(transaction);
  return labelFromCatalog || legacyLabel || DEFAULT_UNCATEGORIZED_LABEL;
}

function isAlreadyInUncategorizedTarget(transaction = {}) {
  const hasCategoryIdField = Object.prototype.hasOwnProperty.call(transaction || {}, "categoryId");
  const normalizedCategoryId = normalizeId(transaction?.categoryId);

  if (hasCategoryIdField && !normalizedCategoryId) {
    return !normalizeId(transaction?.subcategoryId);
  }

  return isUncategorizedName(getTransactionCategoryName(transaction)) && !normalizeId(transaction?.subcategoryId);
}

export function buildClassificationImpactSummary({
  selectedTransactions = [],
  categories = [],
  selectedCategoryId = "",
  selectedCategoryLabel = "",
  uncategorizedValue = "__UNCATEGORIZED__",
} = {}) {
  const categoryById = new Map(
    (categories || [])
      .map((category) => ({ id: normalizeId(category?.id), name: category?.name || "" }))
      .filter((category) => Boolean(category.id))
      .map((category) => [category.id, category])
  );

  const categoryDistributionMap = new Map();

  for (const transaction of selectedTransactions) {
    const label = resolveSnapshotCategoryLabel(transaction, categoryById);
    categoryDistributionMap.set(label, (categoryDistributionMap.get(label) || 0) + 1);
  }

  const categoryDistribution = Array.from(categoryDistributionMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.label.localeCompare(right.label, "fr", { sensitivity: "base" });
    });

  const selectedCount = selectedTransactions.length;
  const normalizedTargetCategoryId = normalizeId(selectedCategoryId);

  if (!normalizedTargetCategoryId) {
    return {
      categoryDistribution,
      selectedCount,
      hasSelectedCategory: false,
      alreadyInTargetCount: 0,
      willChangeCount: 0,
    };
  }

  const targetIsUncategorized = normalizedTargetCategoryId === uncategorizedValue;
  const targetCategory = categories.find((category) => normalizeId(category?.id) === normalizedTargetCategoryId) || null;
  const targetBudgetCategory = {
    categoryId: targetCategory?.id || normalizedTargetCategoryId,
    categoryName: targetCategory?.name || selectedCategoryLabel || "",
  };

  const alreadyInTargetCount = selectedTransactions.filter((transaction) => {
    if (targetIsUncategorized) {
      return isAlreadyInUncategorizedTarget(transaction);
    }

    return isTransactionMatchingBudgetCategory(targetBudgetCategory, transaction);
  }).length;

  return {
    categoryDistribution,
    selectedCount,
    hasSelectedCategory: true,
    alreadyInTargetCount,
    willChangeCount: Math.max(0, selectedCount - alreadyInTargetCount),
  };
}
