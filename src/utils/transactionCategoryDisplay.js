import { getSafeCategoryLabel } from "./displayTextUtils.js";
import { CASH_ADJUSTMENT_LABEL } from "../constants/cashBalanceConstants.js";

const DEFAULT_UNCATEGORIZED_LABEL = "Sans catégorie";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeId(value) {
  return String(value || "").trim();
}

function getLegacyCategoryName(transaction = {}) {
  return String(
    transaction?.categoryName
      || transaction?.categorie
      || transaction?.category
      || ""
  ).trim();
}

export function isUncategorizedCategoryName(value) {
  const normalized = normalizeText(value);
  return normalized === "sans categorie";
}

export function resolveTransactionCategoryMeta(transaction = {}, categories = []) {
  const categoryId = normalizeId(transaction?.categoryId);

  if (categoryId) {
    const byId = categories.find((category) => normalizeId(category?.id) === categoryId);
    if (byId) {
      return byId;
    }
  }

  const legacyCategoryName = getLegacyCategoryName(transaction);
  if (!legacyCategoryName) {
    return null;
  }

  return categories.find(
    (category) => normalizeText(category?.name) === normalizeText(legacyCategoryName)
  ) || null;
}

export function getTransactionDisplayCategoryLabel(transaction = {}, categoryMeta = null) {
  if (String(transaction?.type || "").trim().toLowerCase() === "adjustment") {
    return CASH_ADJUSTMENT_LABEL;
  }

  const hasCategoryIdField = Object.prototype.hasOwnProperty.call(transaction || {}, "categoryId");
  const normalizedCategoryId = normalizeId(transaction?.categoryId);
  const legacyCategoryName = getLegacyCategoryName(transaction);

  if (normalizedCategoryId) {
    return getSafeCategoryLabel(categoryMeta?.name || legacyCategoryName, DEFAULT_UNCATEGORIZED_LABEL);
  }

  if (hasCategoryIdField) {
    if (!legacyCategoryName || isUncategorizedCategoryName(legacyCategoryName)) {
      return DEFAULT_UNCATEGORIZED_LABEL;
    }

    return getSafeCategoryLabel(categoryMeta?.name || legacyCategoryName, DEFAULT_UNCATEGORIZED_LABEL);
  }

  return getSafeCategoryLabel(categoryMeta?.name || legacyCategoryName, DEFAULT_UNCATEGORIZED_LABEL);
}
