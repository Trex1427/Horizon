import {
  matchesExpectedTransaction,
  toDateValue,
} from "./financeCalculations.js";
import { getRecurringIncomeApplicableAmount } from "../utils/recurringIncomeAmount.js";
import {
  isAdjustmentTransactionType,
  isExpenseTransactionType,
  isIncomeTransactionType,
} from "../utils/transactionTypeUtils.js";

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function toValidDate(value) {
  const date = toDateValue(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getMonthStart(year, monthIndex) {
  return new Date(year, monthIndex, 1);
}

function getMonthEnd(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeFrequency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "annual" || normalized === "annuel") return "annual";
  return "monthly";
}

function getFixedExpenseAmount(item, targetDate) {
  const baseAmount = toAmount(item?.initialAmount ?? item?.amount ?? item?.baseAmount);
  const variations = Array.isArray(item?.variations) ? item.variations : [];
  const target = toValidDate(targetDate);

  if (!target || variations.length === 0) {
    return baseAmount;
  }

  const variation = variations
    .filter((entry) => {
      const effectiveDate = toValidDate(entry?.effectiveDate);
      return effectiveDate && effectiveDate <= target;
    })
    .sort((left, right) => {
      const leftDate = toValidDate(left?.effectiveDate);
      const rightDate = toValidDate(right?.effectiveDate);
      return (rightDate?.getTime?.() || 0) - (leftDate?.getTime?.() || 0);
    })[0];

  return toAmount(variation?.amount ?? baseAmount);
}

function isAccountIncluded(accountId, includedAccountIds, fallbackAccountId) {
  const normalizedAccountId = String(accountId || "").trim();
  if (!normalizedAccountId) {
    return Boolean(fallbackAccountId && includedAccountIds.has(fallbackAccountId));
  }

  return includedAccountIds.has(normalizedAccountId);
}

function isRecurringItemDueInMonth(item, monthStart, monthEnd) {
  if (!item?.isActive) {
    return false;
  }

  const startDate = toValidDate(item?.startDate);
  const endDate = toValidDate(item?.endDate);

  if (!startDate) {
    return false;
  }

  if (startDate > monthEnd) {
    return false;
  }

  if (endDate && endDate < monthStart) {
    return false;
  }

  if (normalizeFrequency(item?.frequency) === "annual") {
    return startDate.getMonth() === monthStart.getMonth();
  }

  return true;
}

function getOccurrenceDate(item, monthStart, monthEnd) {
  const startDate = toValidDate(item?.startDate);
  if (!startDate) {
    return monthStart;
  }

  const day = Math.min(startDate.getDate(), monthEnd.getDate());
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), day, 12);
}

function shouldIncludeForecastOccurrence(item, monthStart, monthEnd, referenceDate) {
  if (!isRecurringItemDueInMonth(item, monthStart, monthEnd)) {
    return false;
  }

  if (monthEnd < referenceDate) {
    return false;
  }

  if (monthStart <= referenceDate && referenceDate <= monthEnd) {
    return getOccurrenceDate(item, monthStart, monthEnd) > referenceDate;
  }

  return true;
}

function getBudgetRangeIntersection(budget, monthStart, monthEnd) {
  const startDate = toValidDate(budget?.startDate);
  const endDate = toValidDate(budget?.endDate);

  return {
    start: startDate && startDate > monthStart ? startDate : monthStart,
    end: endDate && endDate < monthEnd ? endDate : monthEnd,
  };
}

function isBudgetApplicableInMonth(budget, monthStart, monthEnd) {
  if (!budget?.isActive || (budget?.typeBudget && budget.typeBudget !== "depense")) {
    return false;
  }

  const startDate = toValidDate(budget?.startDate);
  const endDate = toValidDate(budget?.endDate);

  if (!startDate || startDate > monthEnd) {
    return false;
  }

  if (endDate && endDate < monthStart) {
    return false;
  }

  return true;
}

function sumActualTransactions(transactions, monthStart, cutoffDate, includedAccountIds, fallbackAccountId) {
  return transactions.reduce((totals, transaction) => {
    if (!isAccountIncluded(transaction?.accountId, includedAccountIds, fallbackAccountId)) {
      return totals;
    }

    const date = toValidDate(transaction?.date || transaction?.createdAt || transaction?.timestamp);
    if (!date || date < monthStart || date > cutoffDate) {
      return totals;
    }

    const amount = toAmount(transaction?.montant ?? transaction?.amount);
    if (isIncomeTransactionType(transaction?.type)) {
      totals.revenue += amount;
    }

    if (isExpenseTransactionType(transaction?.type)) {
      totals.expense += amount;
    }

    if (isAdjustmentTransactionType(transaction?.type)) {
      totals.adjustment += amount;
    }

    return totals;
  }, { revenue: 0, expense: 0, adjustment: 0 });
}

function sumTransfersNetImpact(transfers, monthStart, cutoffDate, includedAccountIds) {
  return transfers.reduce((sum, transfer) => {
    const date = toValidDate(transfer?.date || transfer?.createdAt || transfer?.timestamp);
    if (!date || date < monthStart || date > cutoffDate) {
      return sum;
    }

    const amount = toAmount(transfer?.amount);
    if (amount <= 0) {
      return sum;
    }

    const sourceIncluded = includedAccountIds.has(String(transfer?.sourceAccountId || ""));
    const destinationIncluded = includedAccountIds.has(String(transfer?.destinationAccountId || ""));

    if (sourceIncluded && !destinationIncluded) {
      return sum - amount;
    }

    if (!sourceIncluded && destinationIncluded) {
      return sum + amount;
    }

    return sum;
  }, 0);
}

function findExpectedMatch(transactions, item, options) {
  return transactions.some((transaction) => {
    if (options.expectedType === "depense" && String(transaction?.fixedExpenseId || "") === String(item?.id || "")) {
      const transactionDate = toValidDate(transaction?.date || transaction?.createdAt || transaction?.timestamp);
      return (
        isExpenseTransactionType(transaction?.type)
        && transactionDate
        && transactionDate >= options.monthStart
        && transactionDate <= options.monthEnd
      );
    }

    return matchesExpectedTransaction(transaction, item, options);
  });
}

function sumForecastOccurrences({
  items,
  transactions,
  includedAccountIds,
  fallbackAccountId,
  monthStart,
  monthEnd,
  referenceDate,
  type,
}) {
  return (items || []).reduce((sum, item) => {
    if (!isAccountIncluded(item?.accountId, includedAccountIds, fallbackAccountId)) {
      return sum;
    }

    if (!shouldIncludeForecastOccurrence(item, monthStart, monthEnd, referenceDate)) {
      return sum;
    }

    const amount = type === "revenu"
      ? toAmount(getRecurringIncomeApplicableAmount(item, monthEnd))
      : getFixedExpenseAmount(item, monthEnd);

    if (amount <= 0) {
      return sum;
    }

    const alreadyRealized = findExpectedMatch(transactions, item, {
      expectedType: type,
      expectedAmount: amount,
      monthStart,
      monthEnd,
    });

    return alreadyRealized ? sum : sum + amount;
  }, 0);
}

function sumRemainingBudgets({ budgets, transactions, includedAccountIds, fallbackAccountId, monthStart, monthEnd, referenceDate }) {
  if (monthEnd < referenceDate) {
    return 0;
  }

  return (budgets || []).reduce((sum, budget) => {
    if (!isAccountIncluded(budget?.accountId, includedAccountIds, fallbackAccountId)) {
      return sum;
    }

    if (!isBudgetApplicableInMonth(budget, monthStart, monthEnd)) {
      return sum;
    }

    const { start, end } = getBudgetRangeIntersection(budget, monthStart, monthEnd);
    const spent = transactions.reduce((spentSum, transaction) => {
      if (!isExpenseTransactionType(transaction?.type)) {
        return spentSum;
      }

      if (!isAccountIncluded(transaction?.accountId, includedAccountIds, fallbackAccountId)) {
        return spentSum;
      }

      const date = toValidDate(transaction?.date || transaction?.createdAt || transaction?.timestamp);
      if (!date || date < start || date > end || date > referenceDate) {
        return spentSum;
      }

      const transactionCategoryId = String(transaction?.categoryId || "");
      const budgetCategoryId = String(budget?.categoryId || "");
      const transactionCategoryName = String(transaction?.categoryName || transaction?.categorie || transaction?.category || "").trim().toLowerCase();
      const budgetCategoryName = String(budget?.categoryName || budget?.category || "").trim().toLowerCase();
      const matchesCategory = budgetCategoryId
        ? transactionCategoryId === budgetCategoryId || (!transactionCategoryId && transactionCategoryName === budgetCategoryName)
        : Boolean(budgetCategoryName && transactionCategoryName === budgetCategoryName);

      return matchesCategory ? spentSum + toAmount(transaction?.montant ?? transaction?.amount) : spentSum;
    }, 0);

    return sum + Math.max(0, toAmount(budget?.amount) - spent);
  }, 0);
}

function getMonthStatus(monthStart, monthEnd, referenceDate) {
  if (monthEnd < referenceDate) return "actual";
  if (monthStart <= referenceDate && referenceDate <= monthEnd) return "current";
  return "forecast";
}

function shouldIncludeOpportunity(opportunity, {
  monthStart,
  monthEnd,
  referenceDate,
  includedAccountIds,
  fallbackAccountId,
}) {
  if (!opportunity || opportunity.isActive === false || opportunity.isDeleted === true) {
    return false;
  }

  const status = String(opportunity?.status || "").trim().toLowerCase();
  if (status === "realise" || status === "réalisé" || status === "abandonne" || status === "abandonné") {
    return false;
  }

  if (!isAccountIncluded(opportunity?.accountId, includedAccountIds, fallbackAccountId)) {
    return false;
  }

  const date = toValidDate(opportunity?.estimatedDate || opportunity?.date);
  if (!date || date < monthStart || date > monthEnd || date <= referenceDate) {
    return false;
  }

  const amount = toAmount(opportunity?.estimatedAmount ?? opportunity?.amount);
  if (amount <= 0) {
    return false;
  }

  return true;
}

function sumOpportunityIncome({
  opportunities,
  monthStart,
  monthEnd,
  referenceDate,
  includedAccountIds,
  fallbackAccountId,
}) {
  return (opportunities || []).reduce((sum, opportunity) => {
    if (!shouldIncludeOpportunity(opportunity, {
      monthStart,
      monthEnd,
      referenceDate,
      includedAccountIds,
      fallbackAccountId,
    })) {
      return sum;
    }

    return sum + toAmount(opportunity?.estimatedAmount ?? opportunity?.amount);
  }, 0);
}

function countIncludedOpportunities({
  opportunities,
  monthStart,
  monthEnd,
  referenceDate,
  includedAccountIds,
  fallbackAccountId,
}) {
  return (opportunities || []).filter((opportunity) => shouldIncludeOpportunity(opportunity, {
    monthStart,
    monthEnd,
    referenceDate,
    includedAccountIds,
    fallbackAccountId,
  })).length;
}

export function findFixedExpenseDuplicateGroups(fixedExpenses = []) {
  const groups = new Map();

  fixedExpenses
    .filter((item) => item?.isActive)
    .forEach((item) => {
      const key = [
        String(item?.accountId || ""),
        String(item?.name || "").trim().toLowerCase(),
        String(item?.categoryId || item?.categoryName || item?.category || "").trim().toLowerCase(),
        normalizeFrequency(item?.frequency),
        String(item?.startDate || ""),
        String(item?.endDate || ""),
        getFixedExpenseAmount(item, new Date()),
      ].join("|");

      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    });

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => ({
      ids: group.map((item) => item.id).filter(Boolean),
      name: group[0]?.name || group[0]?.categoryName || "Frais fixe",
      count: group.length,
    }));
}

export function findFirstProjectedNegativeMonth(trajectory = []) {
  if (!Array.isArray(trajectory)) {
    return null;
  }

  for (const row of trajectory) {
    const status = String(row?.status || "");
    if (status !== "current" && status !== "forecast") {
      continue;
    }

    const closingBalance = Number(row?.closingBalance);
    const month = String(row?.month || "");
    const isValidMonth = /^\d{4}-\d{2}$/.test(month);
    if (!isValidMonth || !Number.isFinite(closingBalance) || closingBalance >= 0) {
      continue;
    }

    return {
      month,
      closingBalance,
      status,
    };
  }

  return null;
}

export function calculateAnnualTrajectory({
  accounts = [],
  transactions = [],
  transfers = [],
  fixedExpenses = [],
  recurringIncome = [],
  budgets = [],
  opportunities = [],
  forecastMode = null,
  opportunityProbabilityThreshold = null,
  year,
  referenceDate = new Date(),
} = {}) {
  const safeReferenceDate = toValidDate(referenceDate) || new Date();
  const activeYear = Number.isInteger(year) ? year : safeReferenceDate.getFullYear();
  const legacyForecastMode = forecastMode || null;
  const legacyProbabilityThreshold = opportunityProbabilityThreshold ?? null;
  const activeAccounts = (accounts || []).filter((account) => account?.isActive !== false);
  const includedAccountIds = new Set(activeAccounts.map((account) => String(account?.id || "")).filter(Boolean));
  const fallbackAccount = activeAccounts.find((account) => account?.name === "Compte courant") || activeAccounts[0] || null;
  const fallbackAccountId = fallbackAccount?.id || "";
  const safeTransactions = (transactions || [])
    .filter((transaction) => transaction?.isDeleted !== true)
    .filter((transaction) => transaction?.isArchived !== true)
    .filter((transaction) => Number.isFinite(Number(transaction?.montant ?? transaction?.amount)));
  const activeTransfers = (transfers || []).filter((transfer) => transfer?.isActive !== false);
  const initialBalance = activeAccounts.reduce((sum, account) => sum + toAmount(account?.initialBalance), 0);
  const duplicateFixedExpenseGroups = findFixedExpenseDuplicateGroups(fixedExpenses);

  let runningBalance = initialBalance;

  return Array.from({ length: 12 }, (_, monthIndex) => {
    const monthStart = getMonthStart(activeYear, monthIndex);
    const monthEnd = getMonthEnd(activeYear, monthIndex);
    const status = getMonthStatus(monthStart, monthEnd, safeReferenceDate);
    const actualCutoff = status === "current" ? safeReferenceDate : monthEnd;
    const actualTotals = status === "forecast"
      ? { revenue: 0, expense: 0, adjustment: 0 }
      : sumActualTransactions(safeTransactions, monthStart, actualCutoff, includedAccountIds, fallbackAccountId);
    const transferImpact = status === "forecast"
      ? 0
      : sumTransfersNetImpact(activeTransfers, monthStart, actualCutoff, includedAccountIds);
    const expectedRecurringIncome = sumForecastOccurrences({
      items: recurringIncome,
      transactions: safeTransactions,
      includedAccountIds,
      fallbackAccountId,
      monthStart,
      monthEnd,
      referenceDate: safeReferenceDate,
      type: "revenu",
    });
    const expectedFixedExpenses = sumForecastOccurrences({
      items: fixedExpenses,
      transactions: safeTransactions,
      includedAccountIds,
      fallbackAccountId,
      monthStart,
      monthEnd,
      referenceDate: safeReferenceDate,
      type: "depense",
    });
    const remainingBudgets = sumRemainingBudgets({
      budgets,
      transactions: safeTransactions,
      includedAccountIds,
      fallbackAccountId,
      monthStart,
      monthEnd,
      referenceDate: safeReferenceDate,
    });
    const expectedOpportunities = sumOpportunityIncome({
      opportunities,
      monthStart,
      monthEnd,
      referenceDate: safeReferenceDate,
      includedAccountIds,
      fallbackAccountId,
    });
    const expectedOpportunitiesCount = countIncludedOpportunities({
      opportunities,
      monthStart,
      monthEnd,
      referenceDate: safeReferenceDate,
      includedAccountIds,
      fallbackAccountId,
    });
    const monthlyIncome = actualTotals.revenue + expectedRecurringIncome + expectedOpportunities;
    const monthlyExpenses = actualTotals.expense + expectedFixedExpenses + remainingBudgets;
    const monthlyNet = monthlyIncome - monthlyExpenses;

    runningBalance += actualTotals.revenue - actualTotals.expense + actualTotals.adjustment + transferImpact
      + expectedRecurringIncome + expectedOpportunities - expectedFixedExpenses - remainingBudgets;

    return {
      month: toMonthKey(monthStart),
      closingBalance: Number.isFinite(runningBalance) ? runningBalance : 0,
      status,
      actualRevenue: actualTotals.revenue,
      actualExpense: actualTotals.expense,
      actualAdjustment: actualTotals.adjustment,
      transferImpact,
      expectedRecurringIncome,
      expectedOpportunities,
      expectedOpportunitiesCount,
      expectedFixedExpenses,
      remainingBudgets,
      monthlyIncome,
      monthlyExpenses,
      monthlyNet,
      forecastMode: legacyForecastMode,
      opportunityProbabilityThreshold: legacyProbabilityThreshold,
      duplicateFixedExpenseGroups,
    };
  });
}
