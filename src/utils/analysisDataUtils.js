import { matchesExpectedTransaction, toDateValue } from "../services/financeCalculations.js";
import { calculateSharePercentages, mergeSmallCategories } from "./chartDataUtils.js";
import { getRecurringIncomeApplicableAmount } from "./recurringIncomeAmount.js";
import {
  isExpenseTransactionType,
  isIncomeTransactionType,
  normalizeTransactionRecord,
} from "./transactionTypeUtils.js";

function toAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeDate(value) {
  const date = toDateValue(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function normalizeCategoryName(value) {
  const cleaned = String(value || "").trim();
  return cleaned || "Sans categorie";
}

function buildCategoryResolutionContext(categories = [], subcategories = []) {
  if ((categories || []).length === 0 && (subcategories || []).length === 0) {
    return null;
  }

  const activeCategories = (categories || []).filter((category) => category?.isActive !== false);
  const categoriesById = new Map(activeCategories.map((category) => [String(category?.id || "").trim(), category]));
  const subcategoriesById = new Map(
    (subcategories || [])
      .filter((subcategory) => subcategory?.isActive !== false)
      .map((subcategory) => [String(subcategory?.id || "").trim(), subcategory])
  );

  return {
    categoriesById,
    subcategoriesById,
  };
}

function normalizeFrequency(value, kind = "expense") {
  const raw = String(value || "").toLowerCase();

  if (raw === "annual" || raw === "annuel") {
    return "annual";
  }

  if (raw === "monthly" || raw === "mensuel") {
    return "monthly";
  }

  // Fallback prudent: unknown frequency is treated as monthly because this is
  // how legacy fixed/recurring forms default in Horizon.
  return kind === "expense" || kind === "income" ? "monthly" : "monthly";
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getMonthEnd(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function listMonthsInRange(range) {
  const start = getMonthStart(range.start);
  const end = getMonthStart(range.end);
  const months = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    months.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return months;
}

function rangesIntersect(rangeA, rangeB) {
  return rangeA.start <= rangeB.end && rangeA.end >= rangeB.start;
}

function getApplicableAmount(item, targetDate) {
  const baseAmount = toAmount(item?.initialAmount ?? item?.amount ?? 0);
  const variations = Array.isArray(item?.variations) ? item.variations : [];

  if (variations.length === 0) {
    return baseAmount;
  }

  const target = normalizeDate(targetDate);
  if (!target) {
    return baseAmount;
  }

  const variation = variations
    .filter((entry) => {
      const date = normalizeDate(entry?.effectiveDate);
      return date && date <= target;
    })
    .sort((left, right) => (normalizeDate(right?.effectiveDate)?.getTime() || 0) - (normalizeDate(left?.effectiveDate)?.getTime() || 0))[0];

  return toAmount(variation?.amount ?? baseAmount);
}

function isRecurringItemDueInMonth(item, monthDate, kind = "expense") {
  if (!item?.isActive) {
    return false;
  }

  const monthRange = {
    start: getMonthStart(monthDate),
    end: getMonthEnd(monthDate),
  };

  const itemStart = normalizeDate(item?.startDate);
  const itemEnd = normalizeDate(item?.endDate);

  if (!itemStart) {
    return false;
  }

  const activeRange = {
    start: itemStart,
    end: itemEnd || new Date(9999, 11, 31),
  };

  if (!rangesIntersect(monthRange, activeRange)) {
    return false;
  }

  const frequency = normalizeFrequency(item?.frequency, kind);
  if (frequency === "annual") {
    return itemStart.getMonth() === monthDate.getMonth();
  }

  return true;
}

export function getPeriodRange(period = "currentMonth", referenceDate = new Date()) {
  const base = normalizeDate(referenceDate) || new Date();

  if (period === "previousMonth") {
    const previous = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    return {
      start: getMonthStart(previous),
      end: getMonthEnd(previous),
      granularity: "week",
      label: "Mois precedent",
    };
  }

  if (period === "last3Months") {
    const start = new Date(base.getFullYear(), base.getMonth() - 2, 1);
    return {
      start,
      end: getMonthEnd(base),
      granularity: "month",
      label: "3 derniers mois",
    };
  }

  if (period === "currentYear") {
    return {
      start: new Date(base.getFullYear(), 0, 1),
      end: new Date(base.getFullYear(), 11, 31, 23, 59, 59, 999),
      granularity: "month",
      label: "Annee en cours",
    };
  }

  return {
    start: getMonthStart(base),
    end: getMonthEnd(base),
    granularity: "week",
    label: "Mois courant",
  };
}

export function getPreviousPeriodRange(period = "currentMonth", referenceDate = new Date()) {
  const current = getPeriodRange(period, referenceDate);

  if (period === "currentYear") {
    return {
      start: new Date(current.start.getFullYear() - 1, 0, 1),
      end: new Date(current.start.getFullYear() - 1, 11, 31, 23, 59, 59, 999),
      granularity: "month",
      label: "Annee precedente",
    };
  }

  if (period === "last3Months") {
    return {
      start: new Date(current.start.getFullYear(), current.start.getMonth() - 3, 1),
      end: new Date(current.start.getFullYear(), current.start.getMonth(), 0, 23, 59, 59, 999),
      granularity: "month",
      label: "3 mois precedents",
    };
  }

  const previousMonthStart = new Date(current.start.getFullYear(), current.start.getMonth() - 1, 1);

  return {
    start: getMonthStart(previousMonthStart),
    end: getMonthEnd(previousMonthStart),
    granularity: "week",
    label: "Periode precedente",
  };
}

export function filterTransactionsByRangeAndAccount(transactions = [], range, accountId = "all") {
  if (!range?.start || !range?.end) {
    return [];
  }

  return (transactions || []).reduce((filteredTransactions, transaction) => {
    const date = normalizeDate(transaction?.date || transaction?.createdAt || transaction?.timestamp);
    if (!date || date < range.start || date > range.end) {
      return filteredTransactions;
    }

    if (accountId !== "all" && (transaction?.accountId || "") !== accountId) {
      return filteredTransactions;
    }

    if (!isExpenseTransactionType(transaction?.type) && !isIncomeTransactionType(transaction?.type)) {
      return filteredTransactions;
    }

    filteredTransactions.push(normalizeTransactionRecord(transaction));
    return filteredTransactions;
  }, []);
}

function resolveItemCategory(item) {
  return normalizeCategoryName(item?.categoryName || item?.category || item?.name);
}

function resolveRecurringIncomeSourceName(item) {
  const sourceName = String(item?.name || item?.label || item?.description || "").trim();
  return sourceName || "Revenu recurrent";
}

function resolveTransactionCategory(transaction, context = null) {
  const categoryId = String(transaction?.categoryId || "").trim();
  const legacyCategoryName = String(transaction?.categoryName || transaction?.categorie || transaction?.category || "").trim();

  if (categoryId) {
    const category = context?.categoriesById?.get(categoryId);
    if (category?.name) {
      return normalizeCategoryName(category.name);
    }

    return context ? "Categorie introuvable" : normalizeCategoryName(legacyCategoryName);
  }

  const subcategoryId = String(transaction?.subcategoryId || "").trim();
  if (subcategoryId) {
    const subcategory = context?.subcategoriesById?.get(subcategoryId);
    const parentCategoryId = String(subcategory?.categoryId || "").trim();
    const parentCategory = parentCategoryId ? context?.categoriesById?.get(parentCategoryId) : null;

    if (parentCategory?.name) {
      return normalizeCategoryName(parentCategory.name);
    }
  }

  return normalizeCategoryName(legacyCategoryName);
}

function resolveTransactionCategoryId(transaction, context = null) {
  const categoryId = String(transaction?.categoryId || "").trim();
  if (categoryId && context?.categoriesById?.has(categoryId)) {
    return categoryId;
  }

  const subcategoryId = String(transaction?.subcategoryId || "").trim();
  const subcategory = subcategoryId ? context?.subcategoriesById?.get(subcategoryId) : null;
  const parentCategoryId = String(subcategory?.categoryId || "").trim();

  return parentCategoryId && context?.categoriesById?.has(parentCategoryId) ? parentCategoryId : categoryId;
}

function enrichTransactionCategory(transaction, context = null) {
  const categoryName = resolveTransactionCategory(transaction, context);
  return {
    ...transaction,
    categoryName,
    categorie: categoryName,
    categoryId: resolveTransactionCategoryId(transaction, context),
  };
}

function resolveItemAmountByType(item, monthDate, type) {
  if (type === "income") {
    return toAmount(getRecurringIncomeApplicableAmount(item, getMonthEnd(monthDate)));
  }

  return toAmount(getApplicableAmount(item, getMonthEnd(monthDate)));
}

function buildRecurringDueEntries(items = [], range, type = "expense", accountId = "all") {
  const months = listMonthsInRange(range);
  const rows = [];

  (items || []).forEach((item) => {
    if (accountId !== "all" && (item?.accountId || "") !== accountId) {
      return;
    }

    months.forEach((monthDate) => {
      if (!isRecurringItemDueInMonth(item, monthDate, type)) {
        return;
      }

      const monthRange = {
        start: getMonthStart(monthDate),
        end: getMonthEnd(monthDate),
      };

      if (!rangesIntersect(monthRange, range)) {
        return;
      }

      const amount = resolveItemAmountByType(item, monthDate, type);
      if (amount <= 0) {
        return;
      }

      rows.push({
        sourceId: item?.id || `${type === "income" ? resolveRecurringIncomeSourceName(item) : resolveItemCategory(item)}-${toIsoDate(monthDate)}`,
        sourceName: type === "income" ? resolveRecurringIncomeSourceName(item) : (item?.name || resolveItemCategory(item)),
        categoryName: resolveItemCategory(item),
        accountId: item?.accountId || "",
        amount,
        type: type === "income" ? "revenu" : "depense",
        monthStart: monthRange.start,
        monthEnd: monthRange.end,
      });
    });
  });

  return rows;
}

function mapDueEntriesToTransactions(dueEntries = [], transactions = []) {
  const usedTransactionIds = new Set();
  const matchedTransactions = [];

  dueEntries.forEach((entry) => {
    const matchingTransaction = (transactions || []).find((transaction) => {
      if (!transaction?.id || usedTransactionIds.has(transaction.id)) {
        return false;
      }

      const transactionDate = toDateValue(transaction?.date || transaction?.createdAt || transaction?.timestamp);
      const isLinkedFixedExpenseOccurrence = entry.type === "depense"
        && Boolean(entry.sourceId)
        && String(transaction?.fixedExpenseId || "") === String(entry.sourceId)
        && isExpenseTransactionType(transaction?.type)
        && transactionDate >= entry.monthStart
        && transactionDate <= entry.monthEnd;

      return isLinkedFixedExpenseOccurrence || matchesExpectedTransaction(transaction, {
        accountId: entry.accountId,
        categoryName: entry.categoryName,
      }, {
        expectedType: entry.type,
        expectedAmount: entry.amount,
        monthStart: entry.monthStart,
        monthEnd: entry.monthEnd,
      });
    });

    if (matchingTransaction?.id) {
      usedTransactionIds.add(matchingTransaction.id);
      matchedTransactions.push(matchingTransaction);
    }
  });

  return {
    usedTransactionIds,
    matchedTransactions,
  };
}

function sumAmounts(rows = []) {
  return rows.reduce((sum, row) => sum + toAmount(row?.amount ?? row?.montant), 0);
}

export function groupByCategory(rows = [], maxCategories = 6) {
  const grouped = rows.reduce((accumulator, row) => {
    const name = normalizeCategoryName(row?.categoryName || row?.name || row?.categorie);
    accumulator[name] = accumulator[name] || {
      name,
      amount: 0,
      count: 0,
      categoryIds: new Set(),
      transactionIds: new Set(),
      sourceNames: new Set(),
    };
    accumulator[name].amount += toAmount(row?.amount ?? row?.montant);
    accumulator[name].count += 1;

    const categoryId = String(row?.categoryId || "").trim();
    if (categoryId) {
      accumulator[name].categoryIds.add(categoryId);
    }

    const sourceName = String(row?.sourceName || "").trim();
    if (sourceName) {
      accumulator[name].sourceNames.add(sourceName);
    }

    const rowTransactionIds = Array.isArray(row?.transactionIds)
      ? row.transactionIds
      : [row?.id].filter(Boolean);

    rowTransactionIds.forEach((transactionId) => {
      if (transactionId) {
        accumulator[name].transactionIds.add(transactionId);
      }
    });

    return accumulator;
  }, {});

  const items = Object.values(grouped)
    .map((item) => ({
      ...item,
      categoryIds: Array.from(item.categoryIds),
      transactionIds: Array.from(item.transactionIds),
      sourceNames: Array.from(item.sourceNames),
    }))
    .sort((left, right) => right.amount - left.amount);

  const merged = mergeSmallCategories(items, maxCategories);
  const withPercents = calculateSharePercentages(merged);

  return withPercents.map((item) => ({
    ...item,
    count: Number(item.count || 0),
    categoryId: (Array.isArray(item.categoryIds) && item.categoryIds.length === 1) ? item.categoryIds[0] : "",
    transactionIds: Array.isArray(item.transactionIds) ? [...item.transactionIds] : [],
    sourceNames: Array.isArray(item.sourceNames) ? [...item.sourceNames] : [],
    transactionCount: Array.isArray(item.transactionIds) && item.transactionIds.length > 0
      ? item.transactionIds.length
      : Number(item.count || 0),
  }));
}

export function groupRecurringIncomeBySource(rows = [], maxSources = 6) {
  const grouped = rows.reduce((accumulator, row) => {
    const sourceName = String(row?.sourceName || row?.name || row?.label || row?.description || "").trim() || "Revenu recurrent";
    const categoryName = normalizeCategoryName(row?.categoryName || row?.category || "Sans categorie");

    accumulator[sourceName] = accumulator[sourceName] || {
      name: sourceName,
      amount: 0,
      count: 0,
      categoryIds: new Set(),
      transactionIds: new Set(),
      sourceNames: new Set([sourceName]),
      categoryNames: new Set(),
    };

    accumulator[sourceName].amount += toAmount(row?.amount ?? row?.montant);
    accumulator[sourceName].count += 1;
    accumulator[sourceName].categoryNames.add(categoryName);

    const categoryId = String(row?.categoryId || "").trim();
    if (categoryId) {
      accumulator[sourceName].categoryIds.add(categoryId);
    }

    const rowTransactionIds = Array.isArray(row?.transactionIds)
      ? row.transactionIds
      : [row?.id].filter(Boolean);

    rowTransactionIds.forEach((transactionId) => {
      if (transactionId) {
        accumulator[sourceName].transactionIds.add(transactionId);
      }
    });

    return accumulator;
  }, {});

  const items = Object.values(grouped)
    .map((item) => ({
      ...item,
      categoryName: Array.from(item.categoryNames)[0] || "Sans categorie",
      categoryNames: Array.from(item.categoryNames),
      categoryIds: Array.from(item.categoryIds),
      transactionIds: Array.from(item.transactionIds),
      sourceNames: Array.from(item.sourceNames),
    }))
    .sort((left, right) => right.amount - left.amount);

  const merged = mergeSmallCategories(items, maxSources);
  const withPercents = calculateSharePercentages(merged);

  return withPercents.map((item) => ({
    ...item,
    count: Number(item.count || 0),
    categoryName: item.categoryName || "Sans categorie",
    categoryNames: Array.isArray(item.categoryNames) ? [...item.categoryNames] : [item.categoryName || "Sans categorie"],
    categoryId: (Array.isArray(item.categoryIds) && item.categoryIds.length === 1) ? item.categoryIds[0] : "",
    transactionIds: Array.isArray(item.transactionIds) ? [...item.transactionIds] : [],
    sourceNames: Array.isArray(item.sourceNames) ? [...item.sourceNames] : [item.name || "Revenu recurrent"],
    transactionCount: Array.isArray(item.transactionIds) && item.transactionIds.length > 0
      ? item.transactionIds.length
      : Number(item.count || 0),
  }));
}

function buildInteractiveSegments(items = [], options = {}) {
  const includeItemCount = options.includeItemCount === true;

  return (items || []).map((item) => ({
    categoryId: item.categoryId || "",
    categoryName: item.name || "Sans categorie",
    amount: toAmount(item.amount),
    percentage: Number(item.percent || 0),
    transactionCount: Number(item.transactionCount || item.count || 0),
    transactionIds: Array.isArray(item.transactionIds) ? [...item.transactionIds] : [],
    itemCount: includeItemCount ? Number(item.count || 0) : undefined,
    sourceNames: Array.isArray(item.sourceNames) ? [...item.sourceNames] : [],
  }));
}

function buildMatchedSegmentsByCategory(entries = [], matchedTransactions = []) {
  const transactionIdsByCategory = (matchedTransactions || []).reduce((accumulator, transaction) => {
    const categoryName = resolveTransactionCategory(transaction);
    accumulator[categoryName] = accumulator[categoryName] || new Set();
    if (transaction?.id) {
      accumulator[categoryName].add(transaction.id);
    }
    return accumulator;
  }, {});

  const entriesByCategory = (entries || []).reduce((accumulator, entry) => {
    const categoryName = normalizeCategoryName(entry?.categoryName);
    accumulator[categoryName] = accumulator[categoryName] || [];
    accumulator[categoryName].push(entry);
    return accumulator;
  }, {});

  return Object.keys(entriesByCategory).map((categoryName) => ({
    name: categoryName,
    transactionIds: Array.from(transactionIdsByCategory[categoryName] || []),
    sourceNames: entriesByCategory[categoryName]
      .map((entry) => String(entry?.sourceName || "").trim())
      .filter(Boolean)
      .slice(0, 4),
    count: entriesByCategory[categoryName].length,
  }));
}

function getWeekIndexInMonth(date) {
  return Math.min(4, Math.floor((date.getDate() - 1) / 7));
}

function monthShort(date) {
  const labels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aou", "Sep", "Oct", "Nov", "Dec"];
  return labels[date.getMonth()];
}

export function groupByPeriod(rows = [], granularity = "week", valueKey = "amount") {
  if (granularity === "month") {
    const buckets = rows.reduce((accumulator, row) => {
      const date = normalizeDate(row?.date || row?.createdAt || row?.monthStart);
      if (!date) {
        return accumulator;
      }

      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      accumulator[key] = accumulator[key] || {
        label: monthShort(date),
        value: 0,
        count: 0,
      };
      accumulator[key].value += toAmount(row?.[valueKey] ?? row?.amount ?? row?.montant);
      accumulator[key].count += 1;
      return accumulator;
    }, {});

    return Object.entries(buckets)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, value]) => value);
  }

  const buckets = Array.from({ length: 5 }, (_, index) => ({
    label: `S${index + 1}`,
    value: 0,
    count: 0,
  }));

  rows.forEach((row) => {
    const date = normalizeDate(row?.date || row?.createdAt || row?.monthStart);
    if (!date) {
      return;
    }

    const index = getWeekIndexInMonth(date);
    buckets[index].value += toAmount(row?.[valueKey] ?? row?.amount ?? row?.montant);
    buckets[index].count += 1;
  });

  return buckets;
}

export function computeVariation(currentValue = 0, previousValue = 0) {
  const current = toAmount(currentValue);
  const previous = toAmount(previousValue);

  if (previous === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - previous) / previous) * 100;
}

function safeAverage(total, count) {
  if (!count) {
    return 0;
  }

  return toAmount(total) / count;
}

export function buildAnalysisSnapshot({
  transactions = [],
  fixedExpenses = [],
  recurringIncome = [],
  categories = [],
  subcategories = [],
  range,
  previousRange,
  accountId = "all",
  selectedCategory = "all",
} = {}) {
  const categoryResolutionContext = buildCategoryResolutionContext(categories, subcategories);
  const filteredTransactions = filterTransactionsByRangeAndAccount(transactions, range, accountId);
  const filteredPrevTransactions = filterTransactionsByRangeAndAccount(transactions, previousRange, accountId);
  const normalizedSelectedCategory = String(selectedCategory || "all").trim().toLowerCase();
  const matchesSelectedCategory = (value) => normalizedSelectedCategory === "all" || normalizeCategoryName(value).toLowerCase() === normalizedSelectedCategory;

  const fixedDueEntries = buildRecurringDueEntries(fixedExpenses, range, "expense", accountId);
  const fixedPrevDueEntries = buildRecurringDueEntries(fixedExpenses, previousRange, "expense", accountId);
  const recurringIncomeEntries = buildRecurringDueEntries(recurringIncome, range, "income", accountId);
  const recurringIncomePrevEntries = buildRecurringDueEntries(recurringIncome, previousRange, "income", accountId);

  const fixedMatches = mapDueEntriesToTransactions(fixedDueEntries, filteredTransactions);
  const recurringMatches = mapDueEntriesToTransactions(recurringIncomeEntries, filteredTransactions);

  const variableExpenses = filteredTransactions
    .filter((transaction) => isExpenseTransactionType(transaction.type))
    .filter((transaction) => !fixedMatches.usedTransactionIds.has(transaction.id))
    .map((transaction) => enrichTransactionCategory(transaction, categoryResolutionContext));

  const variableRevenues = filteredTransactions
    .filter((transaction) => isIncomeTransactionType(transaction.type))
    .filter((transaction) => !recurringMatches.usedTransactionIds.has(transaction.id))
    .map((transaction) => enrichTransactionCategory(transaction, categoryResolutionContext));

  const prevFixedMatches = mapDueEntriesToTransactions(fixedPrevDueEntries, filteredPrevTransactions);
  const prevRecurringMatches = mapDueEntriesToTransactions(recurringIncomePrevEntries, filteredPrevTransactions);

  const prevVariableExpenses = filteredPrevTransactions
    .filter((transaction) => isExpenseTransactionType(transaction.type))
    .filter((transaction) => !prevFixedMatches.usedTransactionIds.has(transaction.id))
    .map((transaction) => enrichTransactionCategory(transaction, categoryResolutionContext));

  const prevVariableRevenues = filteredPrevTransactions
    .filter((transaction) => isIncomeTransactionType(transaction.type))
    .filter((transaction) => !prevRecurringMatches.usedTransactionIds.has(transaction.id))
    .map((transaction) => enrichTransactionCategory(transaction, categoryResolutionContext));

  const filteredFixedDueEntries = fixedDueEntries.filter((entry) => matchesSelectedCategory(entry.categoryName));
  const filteredFixedPrevDueEntries = fixedPrevDueEntries.filter((entry) => matchesSelectedCategory(entry.categoryName));
  const filteredRecurringIncomeEntries = recurringIncomeEntries.filter((entry) => matchesSelectedCategory(entry.categoryName));
  const filteredRecurringIncomePrevEntries = recurringIncomePrevEntries.filter((entry) => matchesSelectedCategory(entry.categoryName));

  const filteredVariableExpenses = normalizedSelectedCategory === "all"
    ? variableExpenses
    : variableExpenses.filter((transaction) => matchesSelectedCategory(resolveTransactionCategory(transaction, categoryResolutionContext)));

  const filteredVariableRevenues = normalizedSelectedCategory === "all"
    ? variableRevenues
    : variableRevenues.filter((transaction) => matchesSelectedCategory(resolveTransactionCategory(transaction, categoryResolutionContext)));

  const filteredPrevVariableExpenses = normalizedSelectedCategory === "all"
    ? prevVariableExpenses
    : prevVariableExpenses.filter((transaction) => matchesSelectedCategory(resolveTransactionCategory(transaction, categoryResolutionContext)));

  const filteredPrevVariableRevenues = normalizedSelectedCategory === "all"
    ? prevVariableRevenues
    : prevVariableRevenues.filter((transaction) => matchesSelectedCategory(resolveTransactionCategory(transaction, categoryResolutionContext)));

  const fixedTotal = sumAmounts(filteredFixedDueEntries);
  const fixedPrevTotal = sumAmounts(filteredFixedPrevDueEntries);
  const recurringTotal = sumAmounts(filteredRecurringIncomeEntries);
  const recurringPrevTotal = sumAmounts(filteredRecurringIncomePrevEntries);

  const variableExpenseTotal = sumAmounts(filteredVariableExpenses);
  const variableExpensePrevTotal = sumAmounts(filteredPrevVariableExpenses);
  const variableRevenueTotal = sumAmounts(filteredVariableRevenues);
  const variableRevenuePrevTotal = sumAmounts(filteredPrevVariableRevenues);

  const filteredFixedMatchedTransactionsCount = fixedMatches.matchedTransactions.filter((transaction) =>
    matchesSelectedCategory(resolveTransactionCategory(transaction))
  ).length;

  const filteredRecurringMatchedTransactionsCount = recurringMatches.matchedTransactions.filter((transaction) =>
    matchesSelectedCategory(resolveTransactionCategory(transaction))
  ).length;

  const fixedByCategory = groupByCategory(filteredFixedDueEntries, 6);
  const variableExpenseByCategory = groupByCategory(filteredVariableExpenses, 12);
  const recurringIncomeBySource = groupRecurringIncomeBySource(filteredRecurringIncomeEntries, 6);
  const variableRevenueByCategory = groupByCategory(filteredVariableRevenues, 6);

  const fixedMatchSegments = buildMatchedSegmentsByCategory(filteredFixedDueEntries, fixedMatches.matchedTransactions);
  const fixedInteractiveSegments = buildInteractiveSegments(
    fixedByCategory.map((item) => {
      const matched = fixedMatchSegments.find((segment) => segment.name === item.name);
      return {
        ...item,
        transactionIds: matched?.transactionIds || [],
        transactionCount: matched?.transactionIds?.length || 0,
        sourceNames: matched?.sourceNames?.length ? matched.sourceNames : item.sourceNames,
      };
    }),
    { includeItemCount: true }
  );

  const recurringInteractiveSegments = buildInteractiveSegments(recurringIncomeBySource, { includeItemCount: true });

  const variableExpenseInteractiveSegments = buildInteractiveSegments(variableExpenseByCategory);
  const variableRevenueInteractiveSegments = buildInteractiveSegments(variableRevenueByCategory);

  const variableExpenseTrend = groupByPeriod(filteredVariableExpenses, range.granularity, "montant");
  const variableRevenueTrend = groupByPeriod(filteredVariableRevenues, range.granularity, "montant");

  const weeklyBucketCount = range.granularity === "week" ? 5 : Math.max(1, variableExpenseTrend.length || 1);
  const revenueBucketCount = range.granularity === "week" ? 5 : Math.max(1, variableRevenueTrend.length || 1);

  const expensesTotal = fixedTotal + variableExpenseTotal;
  const revenuesTotal = recurringTotal + variableRevenueTotal;

  const fallbackNotes = [];
  if (filteredTransactions.some((transaction) => isExpenseTransactionType(transaction.type)) && fixedMatches.usedTransactionIds.size === 0) {
    fallbackNotes.push("Les depenses anciennes sans correspondance a un frais fixe configure sont classees en variables.");
  }

  if (filteredTransactions.some((transaction) => isIncomeTransactionType(transaction.type)) && recurringMatches.usedTransactionIds.size === 0) {
    fallbackNotes.push("Les revenus anciens sans correspondance a un revenu recurrent configure sont classes en variables.");
  }

  return {
    range,
    previousRange,
    totals: {
      fixedExpenses: fixedTotal,
      variableExpenses: variableExpenseTotal,
      fixedIncome: recurringTotal,
      variableIncome: variableRevenueTotal,
      expenses: expensesTotal,
      revenues: revenuesTotal,
      analyticalBalance: recurringTotal + variableRevenueTotal - fixedTotal - variableExpenseTotal,
    },
    cards: {
      fixedExpenses: {
        total: fixedTotal,
        share: expensesTotal > 0 ? (fixedTotal / expensesTotal) * 100 : 0,
        variation: computeVariation(fixedTotal, fixedPrevTotal),
      },
      variableExpenses: {
        total: variableExpenseTotal,
        share: expensesTotal > 0 ? (variableExpenseTotal / expensesTotal) * 100 : 0,
        variation: computeVariation(variableExpenseTotal, variableExpensePrevTotal),
      },
      fixedIncome: {
        total: recurringTotal,
        share: revenuesTotal > 0 ? (recurringTotal / revenuesTotal) * 100 : 0,
        variation: computeVariation(recurringTotal, recurringPrevTotal),
      },
      variableIncome: {
        total: variableRevenueTotal,
        share: revenuesTotal > 0 ? (variableRevenueTotal / revenuesTotal) * 100 : 0,
        variation: computeVariation(variableRevenueTotal, variableRevenuePrevTotal),
      },
    },
    fixedExpenses: {
      total: fixedTotal,
      count: filteredFixedDueEntries.length,
      variation: computeVariation(fixedTotal, fixedPrevTotal),
      byCategory: fixedByCategory,
      segments: fixedInteractiveSegments,
      matchedTransactionsCount: filteredFixedMatchedTransactionsCount,
    },
    variableExpenses: {
      total: variableExpenseTotal,
      count: filteredVariableExpenses.length,
      variation: computeVariation(variableExpenseTotal, variableExpensePrevTotal),
      byCategory: variableExpenseByCategory,
      segments: variableExpenseInteractiveSegments,
      trend: variableExpenseTrend,
      averagePerBucket: safeAverage(variableExpenseTotal, weeklyBucketCount),
    },
    fixedIncome: {
      total: recurringTotal,
      count: filteredRecurringIncomeEntries.length,
      activeSources: Array.from(new Set(filteredRecurringIncomeEntries.map((entry) => entry.sourceId))).length,
      variation: computeVariation(recurringTotal, recurringPrevTotal),
      byCategory: recurringIncomeBySource,
      segments: recurringInteractiveSegments,
      matchedTransactionsCount: filteredRecurringMatchedTransactionsCount,
    },
    variableIncome: {
      total: variableRevenueTotal,
      count: filteredVariableRevenues.length,
      variation: computeVariation(variableRevenueTotal, variableRevenuePrevTotal),
      byCategory: variableRevenueByCategory,
      segments: variableRevenueInteractiveSegments,
      trend: variableRevenueTrend,
      averagePerBucket: safeAverage(variableRevenueTotal, revenueBucketCount),
      bestBucket: variableRevenueTrend.reduce((best, item) => (item.value > (best?.value || 0) ? item : best), null),
    },
    categoryDetails: {
      variableExpenseCategories: variableExpenseByCategory,
      variableRevenueCategories: variableRevenueByCategory,
    },
    fallbackNotes,
  };
}
