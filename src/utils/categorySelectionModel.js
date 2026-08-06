import { isTechnicalCategoryDisplayValue } from "./displayTextUtils.js";
import { normalizeTransactionType } from "./transactionTypeUtils.js";

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function toTimestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  if (typeof value?.toDate === "function") {
    const date = value.toDate();
    return Number.isFinite(date?.getTime?.()) ? date.getTime() : Number.POSITIVE_INFINITY;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.getTime() : Number.POSITIVE_INFINITY;
}

function buildCategoryKey(category = {}, options = {}) {
  const typeMode = options?.groupByType === false ? "all" : normalizeTransactionType(category.type);
  return `${typeMode}::${normalizeText(category.name)}`;
}

function getLinkedSubcategoryCount(categoryId = "", subcategories = []) {
  const normalizedId = String(categoryId || "");
  return (subcategories || []).filter((subcategory) => String(subcategory?.categoryId || "") === normalizedId).length;
}

function pickCanonicalCategory(group = [], subcategories = []) {
  return [...group].sort((left, right) => {
    const leftLinks = getLinkedSubcategoryCount(left?.id, subcategories);
    const rightLinks = getLinkedSubcategoryCount(right?.id, subcategories);
    if (leftLinks !== rightLinks) return rightLinks - leftLinks;

    const leftOrder = Number(left?.displayOrder || 0);
    const rightOrder = Number(right?.displayOrder || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;

    const leftCreatedAt = toTimestamp(left?.createdAt);
    const rightCreatedAt = toTimestamp(right?.createdAt);
    if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

    return String(left?.id || "").localeCompare(String(right?.id || ""), "fr", { sensitivity: "base" });
  })[0] || null;
}

export function buildCanonicalCategoryReference(categories = [], subcategories = [], options = {}) {
  const typeFilter = options?.type ? normalizeTransactionType(options.type) : "";
  const excludeTechnical = options?.excludeTechnical === true;
  const filtered = (categories || [])
    .filter((category) => (typeFilter ? normalizeTransactionType(category?.type) === typeFilter : true))
    .filter((category) => category?.isActive !== false)
    .filter((category) => (!excludeTechnical ? true : !isTechnicalCategoryDisplayValue(category?.name)));

  const groups = new Map();
  filtered.forEach((category) => {
    const key = buildCategoryKey(category, options);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(category);
  });

  const canonicalIdById = new Map();
  const aliasIdsByCanonicalId = new Map();
  const categoryOptions = [];

  groups.forEach((group) => {
    const canonical = pickCanonicalCategory(group, subcategories);
    if (!canonical) return;

    const aliases = new Set(group.map((category) => String(category?.id || "")).filter(Boolean));
    const canonicalId = String(canonical.id || "");
    if (!canonicalId) return;

    aliases.forEach((categoryId) => {
      canonicalIdById.set(categoryId, canonicalId);
    });

    aliasIdsByCanonicalId.set(canonicalId, aliases);
    categoryOptions.push(canonical);
  });

  categoryOptions.sort((left, right) => {
    const leftOrder = Number(left?.displayOrder || 0);
    const rightOrder = Number(right?.displayOrder || 0);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return String(left?.name || "").localeCompare(String(right?.name || ""), "fr", { sensitivity: "base" });
  });

  return {
    categoryOptions,
    canonicalIdById,
    aliasIdsByCanonicalId,
  };
}

export function buildExpenseCategoryReference(categories = [], subcategories = []) {
  return buildCanonicalCategoryReference(categories, subcategories, {
    type: "depense",
    excludeTechnical: true,
    groupByType: true,
  });
}

export function getCanonicalCategoryId(reference = {}, categoryId = "") {
  const normalizedId = String(categoryId || "");
  if (!normalizedId) return "";
  return reference?.canonicalIdById?.get(normalizedId) || normalizedId;
}

export function getSubcategoriesForCanonicalCategory(subcategories = [], categoryId = "", reference = {}) {
  const canonicalCategoryId = getCanonicalCategoryId(reference, categoryId);
  if (!canonicalCategoryId) return [];

  const aliasIds = reference?.aliasIdsByCanonicalId?.get(canonicalCategoryId) || new Set([canonicalCategoryId]);
  return (subcategories || [])
    .filter((subcategory) => subcategory?.isActive !== false)
    .filter((subcategory) => aliasIds.has(String(subcategory?.categoryId || "")))
    .sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "fr", { sensitivity: "base" }));
}
