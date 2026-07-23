import {
  calculateBudgetSpentAmount,
  calculateCurrentAccountsBalance,
  isDateInRange,
  matchesExpectedTransaction,
  toDateValue,
} from "./financeCalculations.js";
import { getRecurringIncomeApplicableAmount } from "../utils/recurringIncomeAmount.js";

function toNumber(value) {
  return Number(value) || 0;
}

function getMonthBounds(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  return {
    start: new Date(year, month, 1),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

function isDateInCurrentMonth(targetDate, monthBounds) {
  return isDateInRange(targetDate, monthBounds.start, monthBounds.end);
}

function normalizeFrequency(value) {
  if (!value) return "mensuel";

  if (value === "monthly") return "mensuel";
  if (value === "annual") return "annuel";

  return value;
}

function getApplicableAmount(item, targetDate) {
  const baseAmount = toNumber(item?.initialAmount ?? item?.amount ?? 0);
  const variations = Array.isArray(item?.variations) ? item.variations : [];
  const target = toDateValue(targetDate);

  if (!target || variations.length === 0) {
    return baseAmount;
  }

  const latestVariation = variations
    .filter((variation) => {
      const effectiveDate = toDateValue(variation?.effectiveDate);
      return effectiveDate && effectiveDate <= target;
    })
    .sort((left, right) => {
      const leftDate = toDateValue(left?.effectiveDate);
      const rightDate = toDateValue(right?.effectiveDate);
      return (rightDate?.getTime?.() || 0) - (leftDate?.getTime?.() || 0);
    })[0];

  return toNumber(latestVariation?.amount ?? baseAmount);
}

function isRecurringItemDueThisMonth(item, monthBounds) {
  if (!item?.isActive) {
    return false;
  }

  const startDate = toDateValue(item?.startDate);
  const endDate = toDateValue(item?.endDate);

  if (!startDate) {
    return false;
  }

  if (endDate && endDate < monthBounds.start) {
    return false;
  }

  if (startDate > monthBounds.end) {
    return false;
  }

  const frequency = normalizeFrequency(item?.frequency);

  if (frequency === "annuel") {
    return startDate.getMonth() === monthBounds.start.getMonth();
  }

  return true;
}

function isBudgetApplicableThisMonth(budget, monthBounds) {
  if (!budget?.isActive) {
    return false;
  }

  if (budget?.typeBudget && budget.typeBudget !== "depense") {
    return false;
  }

  const startDate = toDateValue(budget?.startDate);
  const endDate = toDateValue(budget?.endDate);

  if (!startDate) {
    return false;
  }

  if (startDate > monthBounds.end) {
    return false;
  }

  if (endDate && endDate < monthBounds.start) {
    return false;
  }

  return true;
}

function getBudgetIntersectionRange(budget, monthBounds) {
  const monthStart = toDateValue(monthBounds.start);
  const monthEnd = toDateValue(monthBounds.end);
  const budgetStart = toDateValue(budget?.startDate);
  const budgetEnd = toDateValue(budget?.endDate) || monthEnd;

  const start = budgetStart && budgetStart > monthStart ? budgetStart : monthStart;
  const end = budgetEnd && budgetEnd < monthEnd ? budgetEnd : monthEnd;

  return { start, end };
}

export function calculateMonthlyForecast({
  accounts = [],
  transactions = [],
  transfers = [],
  fixedExpenses = [],
  recurringIncome = [],
  budgets = [],
  referenceDate = new Date(),
} = {}) {
  const monthBounds = getMonthBounds(referenceDate);

  const currentBalance = calculateCurrentAccountsBalance(accounts, transactions, transfers);

  const expectedRecurringIncome = (recurringIncome || [])
    .filter((income) => isRecurringItemDueThisMonth(income, monthBounds))
    .reduce((sum, income) => {
      const amount = getRecurringIncomeApplicableAmount(income, monthBounds.end);
      if (amount <= 0) return sum;

      const alreadyRealized = (transactions || []).some((transaction) =>
        matchesExpectedTransaction(transaction, income, {
          expectedType: "revenu",
          expectedAmount: amount,
          monthStart: monthBounds.start,
          monthEnd: monthBounds.end,
        })
      );

      return alreadyRealized ? sum : sum + amount;
    }, 0);

  const expectedFixedExpenses = (fixedExpenses || [])
    .filter((fixedExpense) => isRecurringItemDueThisMonth(fixedExpense, monthBounds))
    .reduce((sum, fixedExpense) => {
      const amount = getApplicableAmount(fixedExpense, monthBounds.end);
      if (amount <= 0) return sum;

      const alreadyRealized = (transactions || []).some((transaction) =>
        (String(transaction?.fixedExpenseId || "") === String(fixedExpense?.id || "")
          && transaction?.type === "depense"
          && isDateInCurrentMonth(toDateValue(transaction?.date), monthBounds))
        || matchesExpectedTransaction(transaction, fixedExpense, {
          expectedType: "depense",
          expectedAmount: amount,
          monthStart: monthBounds.start,
          monthEnd: monthBounds.end,
        })
      );

      return alreadyRealized ? sum : sum + amount;
    }, 0);

  const remainingBudgets = (budgets || [])
    .filter((budget) => isBudgetApplicableThisMonth(budget, monthBounds))
    .reduce((sum, budget) => {
      const budgetAmount = toNumber(budget?.amount);
      const range = getBudgetIntersectionRange(budget, monthBounds);
      const spentAmount = calculateBudgetSpentAmount(budget, transactions, {
        startDate: range.start,
        endDate: range.end,
      });
      const remaining = Math.max(0, budgetAmount - spentAmount);
      return sum + remaining;
    }, 0);

  const forecastEndOfMonth = currentBalance + expectedRecurringIncome - expectedFixedExpenses - remainingBudgets;

  return {
    currentBalance,
    expectedRecurringIncome,
    expectedFixedExpenses,
    remainingBudgets,
    forecastEndOfMonth,
    monthStart: monthBounds.start,
    monthEnd: monthBounds.end,
  };
}
