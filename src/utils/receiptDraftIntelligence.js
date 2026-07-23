export const RECEIPT_INTELLIGENCE_DEFAULTS = {
  items: [],
  keywords: [],
  suggestedCategoryId: null,
  suggestedCategoryName: null,
  suggestedCategory: null,
  categoryConfidence: null,
  categoryReason: "",
  merchantConfidence: null,
  dateConfidence: null,
  amountConfidence: null,
  overallConfidence: null,
};

export const HIGH_CATEGORY_CONFIDENCE_THRESHOLD = 0.9;
export const MEDIUM_CATEGORY_CONFIDENCE_THRESHOLD = 0.6;

function sanitizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    return null;
  }

  return normalized;
}

function normalizeItemAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeItemQuantity(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeReceiptItem(item) {
  const label = sanitizeString(item?.label);

  if (!label) {
    return null;
  }

  return {
    label,
    quantity: normalizeItemQuantity(item?.quantity),
    unitAmount: normalizeItemAmount(item?.unitAmount),
    amount: normalizeItemAmount(item?.amount),
  };
}

function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  for (const keyword of keywords) {
    const cleaned = sanitizeString(keyword).toLowerCase();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    normalized.push(cleaned);

    if (normalized.length >= 10) {
      break;
    }
  }

  return normalized;
}

export function normalizeCategoryName(value) {
  return sanitizeString(value).toLowerCase();
}

function normalizeCategoryId(value) {
  return sanitizeString(value);
}

export function buildAvailableCategoryCatalog(categories = []) {
  if (!Array.isArray(categories)) {
    return [];
  }

  const seenById = new Set();
  const catalog = [];

  categories.forEach((category) => {
    const id = normalizeCategoryId(category?.id);
    const name = sanitizeString(category?.name);
    const type = sanitizeString(category?.type) || "depense";

    if (!id || !name || seenById.has(id)) {
      return;
    }

    seenById.add(id);
    catalog.push({
      id,
      name,
      type,
    });
  });

  return catalog;
}

export function normalizeReceiptDraft(rawDraft = {}) {
  const items = Array.isArray(rawDraft?.items)
    ? rawDraft.items.map(normalizeReceiptItem).filter(Boolean)
    : [];

  const suggestedCategoryId = normalizeCategoryId(rawDraft?.suggestedCategoryId) || null;
  const suggestedCategoryName =
    sanitizeString(rawDraft?.suggestedCategoryName) || sanitizeString(rawDraft?.suggestedCategory) || null;

  return {
    ...rawDraft,
    items,
    keywords: normalizeKeywords(rawDraft?.keywords),
    suggestedCategoryId,
    suggestedCategoryName,
    suggestedCategory: suggestedCategoryName,
    categoryConfidence: normalizeConfidence(rawDraft?.categoryConfidence),
    categoryReason: sanitizeString(rawDraft?.categoryReason),
    merchantConfidence: normalizeConfidence(rawDraft?.merchantConfidence),
    dateConfidence: normalizeConfidence(rawDraft?.dateConfidence),
    amountConfidence: normalizeConfidence(rawDraft?.amountConfidence),
    overallConfidence: normalizeConfidence(rawDraft?.overallConfidence),
  };
}

function findMatchingCategoryById(categories = [], type = "depense", suggestedCategoryId = "") {
  const normalizedId = normalizeCategoryId(suggestedCategoryId);
  if (!normalizedId) {
    return null;
  }

  return (
    buildAvailableCategoryCatalog(categories).find(
      (category) => category.id === normalizedId && category.type === (type || "depense")
    ) || null
  );
}

function hasExplicitCategorySelection(draft) {
  return Boolean(sanitizeString(draft.categoryId) || sanitizeString(draft.categoryName || draft.categorie));
}

export function findMatchingCategory(categories = [], type = "depense", suggestedCategoryId = "") {
  return findMatchingCategoryById(categories, type, suggestedCategoryId);
}

export function getReceiptCategorySuggestionState(rawDraft, categories = []) {
  const draft = normalizeReceiptDraft(rawDraft);
  const matchedCategory = findMatchingCategoryById(categories, draft.type, draft.suggestedCategoryId);
  const confidence = draft.categoryConfidence;
  const hasConfidence = confidence !== null;
  const hasSuggestion = Boolean(
    sanitizeString(draft.suggestedCategoryId) || sanitizeString(draft.suggestedCategoryName || draft.suggestedCategory)
  );
  const hasSelectedCategory = hasExplicitCategorySelection(draft);
  const hasValidSuggestedCategoryId = Boolean(matchedCategory);
  const isHighConfidence = hasConfidence && confidence >= HIGH_CATEGORY_CONFIDENCE_THRESHOLD;
  const isMediumConfidence =
    hasConfidence &&
    confidence >= MEDIUM_CATEGORY_CONFIDENCE_THRESHOLD &&
    confidence < HIGH_CATEGORY_CONFIDENCE_THRESHOLD;
  const isLowConfidence = hasConfidence && confidence < MEDIUM_CATEGORY_CONFIDENCE_THRESHOLD;

  return {
    visible:
      hasSuggestion ||
      Boolean(draft.categoryReason) ||
      draft.keywords.length > 0 ||
      draft.items.length > 0 ||
      draft.merchantConfidence !== null ||
      draft.dateConfidence !== null ||
      draft.amountConfidence !== null,
    hasSuggestion,
    matchedCategory,
    confidence,
    suggestedDisplayName: matchedCategory?.name || draft.suggestedCategoryName || draft.suggestedCategory || "",
    hasValidSuggestedCategoryId,
    prefillEligible: Boolean(hasValidSuggestedCategoryId && isHighConfidence),
    autoSelected: Boolean(matchedCategory && isHighConfidence && hasSelectedCategory),
    requiresReview: Boolean(isMediumConfidence),
    shouldHideAutoSelection: Boolean(!hasValidSuggestedCategoryId || isLowConfidence),
    level: !hasSuggestion
      ? "none"
      : !hasValidSuggestedCategoryId
        ? "unknown"
        : isHighConfidence
          ? "high"
          : isMediumConfidence
            ? "medium"
            : isLowConfidence
              ? "low"
              : "unknown",
  };
}

export function applyReceiptCategorySuggestion(rawDraft, categories = []) {
  const draft = normalizeReceiptDraft(rawDraft);
  const suggestionState = getReceiptCategorySuggestionState(draft, categories);
  const hasExplicitCategory = hasExplicitCategorySelection(draft);

  if (
    !suggestionState.matchedCategory ||
    !suggestionState.prefillEligible ||
    hasExplicitCategory
  ) {
    return {
      ...draft,
      receiptCategorySuggestionState: suggestionState.level,
      matchedSuggestedCategoryId: suggestionState.matchedCategory?.id || "",
      matchedSuggestedCategoryName:
        suggestionState.matchedCategory?.name || draft.suggestedCategoryName || draft.suggestedCategory || "",
    };
  }

  return {
    ...draft,
    categorie: suggestionState.matchedCategory.name,
    categoryName: suggestionState.matchedCategory.name,
    categoryId: suggestionState.matchedCategory.id || "",
    receiptCategorySuggestionState: suggestionState.level,
    matchedSuggestedCategoryId: suggestionState.matchedCategory.id || "",
    matchedSuggestedCategoryName: suggestionState.matchedCategory.name,
  };
}