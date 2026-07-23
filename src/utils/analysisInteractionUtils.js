import { toDateValue } from "../services/financeCalculations.js";
import { getPeriodRange } from "./analysisDataUtils.js";
import { normalizeTransactionType } from "./transactionTypeUtils.js";

function normalizeCategoryName(value) {
  return String(value || "").trim().toLowerCase();
}

function toAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeSearchValue(value) {
  return String(value || "").trim().toLowerCase();
}

function compareStringsAsc(left, right) {
  return String(left || "").localeCompare(String(right || ""), "fr", { sensitivity: "base" });
}

function compareNumbersAsc(left, right) {
  return toAmount(left) - toAmount(right);
}

function getTransactionSortValue(transaction = {}, field = "date", getAccountLabel = null) {
  if (field === "amount") {
    return toAmount(transaction.montant);
  }

  if (field === "description") {
    return String(transaction.description || "");
  }

  if (field === "category") {
    return String(transaction.categoryName || transaction.categorie || transaction.category || "");
  }

  if (field === "account") {
    if (typeof getAccountLabel === "function") {
      return getAccountLabel(transaction.accountId || "");
    }

    return String(transaction.accountId || "");
  }

  if (field === "type") {
    return String(normalizeTransactionType(transaction.type));
  }

  return toDateValue(transaction.date || transaction.createdAt || transaction.timestamp)?.getTime() || 0;
}

function compareByField(field, direction, leftValue, rightValue) {
  const factor = direction === "asc" ? 1 : -1;

  if (field === "amount" || field === "date") {
    return compareNumbersAsc(leftValue, rightValue) * factor;
  }

  return compareStringsAsc(leftValue, rightValue) * factor;
}

export function buildChartSegment(entry = {}) {
  const transactionIds = Array.isArray(entry.transactionIds)
    ? [...entry.transactionIds]
    : [];

  return {
    categoryId: entry.categoryId || "",
    categoryName: String(entry.name || entry.categoryName || "Sans categorie"),
    amount: toAmount(entry.amount),
    percentage: Number(entry.percent || 0),
    transactionCount: Number(entry.transactionCount ?? entry.count ?? transactionIds.length ?? 0),
    transactionIds,
    itemCount: Number(entry.itemCount ?? entry.count ?? 0),
    sourceNames: Array.isArray(entry.sourceNames) ? [...entry.sourceNames] : [],
  };
}

export function buildTransactionsNavigationFilters({
  sectionType = "expense-variable",
  segment,
  period = "currentMonth",
  accountId = "all",
} = {}) {
  const isIncomeSection = String(sectionType).includes("income");
  const normalizedSegment = buildChartSegment(segment);

  return {
    source: "analysis",
    type: isIncomeSection ? "revenu" : "depense",
    period,
    accountId,
    categoryId: normalizedSegment.categoryId || "all",
    categoryName: normalizedSegment.categoryName || "all",
    transactionIds: [...normalizedSegment.transactionIds],
    requestId: Date.now(),
  };
}

export function filterTransactionsForView(transactions = [], filters = {}, referenceDate = new Date(), options = {}) {
  const period = filters.period || "currentYear";
  const periodRange = getPeriodRange(period, referenceDate);
  const expectedType = filters.type || "all";
  const expectedAccountId = filters.accountId || "all";
  const expectedCategoryId = filters.categoryId || "all";
  const expectedCategoryName = filters.categoryName || "all";
  const expectedSubcategoryId = filters.subcategoryId || "all";
  const expectedActivityId = filters.activityId || "all";
  const expectedThirdPartyId = filters.thirdPartyId || "all";
  const expectedProjectId = filters.projectId || "all";
  const textSearch = normalizeSearchValue(filters.searchText);
  const getAccountLabel = typeof options.getAccountLabel === "function" ? options.getAccountLabel : null;
  const filterTransactionIds = Array.isArray(filters.transactionIds)
    ? new Set(filters.transactionIds)
    : null;

  return (transactions || []).filter((transaction) => {
    if (!transaction) {
      return false;
    }

    const normalizedType = normalizeTransactionType(transaction.type);
    if (expectedType !== "all" && normalizedType !== expectedType) {
      return false;
    }

    if (expectedAccountId !== "all" && (transaction.accountId || "") !== expectedAccountId) {
      return false;
    }

    const transactionDate = toDateValue(transaction.date || transaction.createdAt || transaction.timestamp);
    if (!transactionDate || transactionDate < periodRange.start || transactionDate > periodRange.end) {
      return false;
    }

    if (filterTransactionIds && filterTransactionIds.size > 0) {
      return filterTransactionIds.has(transaction.id);
    }

    if (expectedCategoryId !== "all") {
      if ((transaction.categoryId || "") !== expectedCategoryId) {
        return false;
      }
    }

    if (expectedCategoryName !== "all") {
      const transactionCategory = transaction.categoryName || transaction.categorie || transaction.category || "";
      if (normalizeCategoryName(transactionCategory) !== normalizeCategoryName(expectedCategoryName)) {
        return false;
      }
    }

    if (expectedSubcategoryId !== "all" && (transaction.subcategoryId || "") !== expectedSubcategoryId) {
      return false;
    }

    if (expectedActivityId !== "all" && (transaction.activityId || "") !== expectedActivityId) {
      return false;
    }

    if (expectedThirdPartyId !== "all" && (transaction.thirdPartyId || "") !== expectedThirdPartyId) {
      return false;
    }

    if (expectedProjectId !== "all" && (transaction.projectId || "") !== expectedProjectId) {
      return false;
    }

    if (textSearch) {
      const searchableFields = [
        transaction.description,
        transaction.categoryName,
        transaction.categorie,
        transaction.category,
        transaction.accountName,
        transaction.accountId,
        getAccountLabel ? getAccountLabel(transaction.accountId || "") : "",
        transaction.type,
        transaction.subcategoryName,
        transaction.activityName,
        transaction.thirdPartyName,
        transaction.projectName,
      ];

      const hasMatch = searchableFields
        .map(normalizeSearchValue)
        .some((value) => value.includes(textSearch));

      if (!hasMatch) {
        return false;
      }
    }

    return true;
  });
}

export function sortTransactionsForView(transactions = [], sort = {}, options = {}) {
  const sortField = sort.field || "date";
  const direction = sort.direction || "desc";
  const getAccountLabel = typeof options.getAccountLabel === "function" ? options.getAccountLabel : null;

  return [...(transactions || [])].sort((left, right) => {
    const leftValue = getTransactionSortValue(left, sortField, getAccountLabel);
    const rightValue = getTransactionSortValue(right, sortField, getAccountLabel);
    const comparison = compareByField(sortField, direction, leftValue, rightValue);

    if (comparison !== 0) {
      return comparison;
    }

    const leftDate = getTransactionSortValue(left, "date", getAccountLabel);
    const rightDate = getTransactionSortValue(right, "date", getAccountLabel);
    const dateFallback = compareByField("date", "desc", leftDate, rightDate);

    if (dateFallback !== 0) {
      return dateFallback;
    }

    return compareStringsAsc(left?.id || "", right?.id || "");
  });
}

export function getDetailCountLabel(sectionType = "expense-variable", segment = {}) {
  const normalizedSegment = buildChartSegment(segment);
  const isIncomeSection = String(sectionType).includes("income");
  const isFixedSection = String(sectionType).includes("fixed");

  if (isFixedSection && normalizedSegment.transactionIds.length === 0) {
    return `${normalizedSegment.itemCount} postes`;
  }

  if (isIncomeSection) {
    return `${normalizedSegment.transactionCount} revenus`;
  }

  return `${normalizedSegment.transactionCount} transactions`;
}

export function getDetailActionLabel(sectionType = "expense-variable") {
  return String(sectionType).includes("income") ? "Voir les revenus" : "Voir les transactions";
}

export function getDefaultTransactionsListFilters() {
  return {
    period: "currentYear",
    type: "all",
    accountId: "all",
    categoryId: "all",
    categoryName: "all",
    subcategoryId: "all",
    activityId: "all",
    thirdPartyId: "all",
    projectId: "all",
    searchText: "",
    transactionIds: [],
  };
}

export function getDefaultTransactionSortPreferences() {
  return {
    field: "date",
    direction: "desc",
  };
}

export function applyTransactionsNavigationContext(navigationContext = null) {
  const defaults = getDefaultTransactionsListFilters();

  if (!navigationContext || navigationContext.source !== "analysis") {
    return defaults;
  }

  return {
    period: navigationContext.period || defaults.period,
    type: navigationContext.type || defaults.type,
    accountId: navigationContext.accountId || defaults.accountId,
    categoryId: navigationContext.categoryId || defaults.categoryId,
    categoryName: navigationContext.categoryName || defaults.categoryName,
    subcategoryId: defaults.subcategoryId,
    activityId: defaults.activityId,
    thirdPartyId: defaults.thirdPartyId,
    projectId: defaults.projectId,
    searchText: defaults.searchText,
    transactionIds: Array.isArray(navigationContext.transactionIds)
      ? [...navigationContext.transactionIds]
      : [],
  };
}