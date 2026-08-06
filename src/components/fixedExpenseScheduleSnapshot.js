import {
  RECONCILIATION_DECISIONS,
  scoreTransactionAgainstFixedExpense,
} from "../services/reconciliationService.js";
import { toDateValue } from "../services/financeCalculations.js";

function toValidDate(value) {
  const date = toDateValue(value);
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeFrequency(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "annual" || normalized === "annuel") return "annual";
  if (normalized === "weekly" || normalized === "hebdomadaire") return "weekly";
  return "monthly";
}

function addMonths(date, monthCount = 1) {
  const safeDate = toValidDate(date);
  if (!safeDate) return null;

  const day = safeDate.getDate();
  const anchor = new Date(safeDate.getFullYear(), safeDate.getMonth() + monthCount, 1, 12);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, monthEnd));
  return anchor;
}

function addYears(date, yearCount = 1) {
  const safeDate = toValidDate(date);
  if (!safeDate) return null;

  const day = safeDate.getDate();
  const anchor = new Date(safeDate.getFullYear() + yearCount, safeDate.getMonth(), 1, 12);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, monthEnd));
  return anchor;
}

function addPeriod(date, frequency) {
  const safeDate = toValidDate(date);
  if (!safeDate) return null;

  if (frequency === "weekly") {
    return new Date(safeDate.getTime() + (7 * 24 * 60 * 60 * 1000));
  }

  if (frequency === "annual") {
    return addYears(safeDate, 1);
  }

  return addMonths(safeDate, 1);
}

function subtractPeriod(date, frequency) {
  const safeDate = toValidDate(date);
  if (!safeDate) return null;

  if (frequency === "weekly") {
    return new Date(safeDate.getTime() - (7 * 24 * 60 * 60 * 1000));
  }

  if (frequency === "annual") {
    return addYears(safeDate, -1);
  }

  return addMonths(safeDate, -1);
}

function getMonthBounds(date) {
  const safeDate = toValidDate(date);
  if (!safeDate) return { monthStart: null, monthEnd: null };
  return {
    monthStart: new Date(safeDate.getFullYear(), safeDate.getMonth(), 1),
    monthEnd: new Date(safeDate.getFullYear(), safeDate.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getExpectedDateForTransaction({ transactionDate, frequency, startDate }) {
  if (!transactionDate) return null;

  if (frequency !== "weekly" || !startDate) {
    return null;
  }

  const diffDays = Math.round((transactionDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
  const roundedWeek = Math.round(diffDays / 7);
  return new Date(startDate.getTime() + (roundedWeek * 7 * 24 * 60 * 60 * 1000));
}

function getComparableTransactions({ transactions = [], fixedExpense = {}, transactionIndex = null }) {
  const source = Array.isArray(transactionIndex?.all) ? transactionIndex.all : transactions;
  return source.filter((transaction) => {
    if (!transaction || String(transaction.type || "").toLowerCase() !== "depense") return false;

    const fixedExpenseAccountId = String(fixedExpense.accountId || "").trim();
    const transactionAccountId = String(transaction.accountId || "").trim();
    if (fixedExpenseAccountId && transactionAccountId && fixedExpenseAccountId !== transactionAccountId) {
      return false;
    }

    const fixedExpenseSubcategoryId = String(fixedExpense.subcategoryId || "").trim();
    const transactionSubcategoryId = String(transaction.subcategoryId || "").trim();
    if (fixedExpenseSubcategoryId && transactionSubcategoryId && fixedExpenseSubcategoryId !== transactionSubcategoryId) {
      return false;
    }

    return true;
  });
}

function resolveStatus({ nextEstimatedDate, referenceDate }) {
  if (!nextEstimatedDate) {
    return {
      key: "unknown",
      label: "Estimation indisponible",
      color: "text.secondary",
    };
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  const nextDate = new Date(nextEstimatedDate.getFullYear(), nextEstimatedDate.getMonth(), nextEstimatedDate.getDate());
  const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    return {
      key: "late",
      label: "🔴 En retard",
      color: "error.main",
    };
  }

  if (diffDays <= 3) {
    return {
      key: "dueSoon",
      label: "🟠 Échéance proche",
      color: "warning.main",
    };
  }

  return {
    key: "upToDate",
    label: "🟢 À jour",
    color: "success.main",
  };
}

export function buildFixedExpenseScheduleSnapshot({
  fixedExpense = {},
  transactions = [],
  transactionIndex = null,
  referenceDate = new Date(),
} = {}) {
  const frequency = normalizeFrequency(fixedExpense.frequency);
  const startDate = toValidDate(fixedExpense.startDate);
  const reference = toValidDate(referenceDate) || new Date();
  const candidates = getComparableTransactions({ transactions, fixedExpense, transactionIndex });
  const fixedExpenseId = String(fixedExpense.id || "").trim();

  const explicitLinked = candidates
    .filter((transaction) => String(transaction.fixedExpenseId || "").trim() === fixedExpenseId)
    .map((transaction) => ({
      transaction,
      date: toValidDate(transaction.date || transaction.operationDate || transaction.createdAt || transaction.timestamp),
      amount: Math.abs(toAmount(transaction.montant ?? transaction.amount)),
      decision: RECONCILIATION_DECISIONS.AUTO,
      score: 1,
    }))
    .filter((entry) => Boolean(entry.date));

  const candidateMatches = candidates
    .map((transaction) => {
      const transactionDate = toValidDate(transaction.date || transaction.operationDate || transaction.createdAt || transaction.timestamp);
      if (!transactionDate) return null;

      const expectedDate = getExpectedDateForTransaction({ transactionDate, frequency, startDate });
      const { monthStart, monthEnd } = getMonthBounds(expectedDate || transactionDate);
      const evaluation = scoreTransactionAgainstFixedExpense(transaction, fixedExpense, {
        monthStart,
        monthEnd,
        expectedDate,
        expectedAmount: fixedExpense.initialAmount,
      });

      if (evaluation.decision !== RECONCILIATION_DECISIONS.AUTO) return null;

      return {
        transaction,
        date: transactionDate,
        amount: Math.abs(toAmount(transaction.montant ?? transaction.amount)),
        decision: evaluation.decision,
        score: evaluation.score,
      };
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right.date.getTime() !== left.date.getTime()) {
        return right.date.getTime() - left.date.getTime();
      }
      return right.score - left.score;
    });

  const deduplicatedMatches = [];
  const seenTransactionIds = new Set();
  [...explicitLinked, ...candidateMatches].forEach((entry) => {
    const transactionId = String(entry.transaction.id || "").trim();
    if (!transactionId || seenTransactionIds.has(transactionId)) return;
    seenTransactionIds.add(transactionId);
    deduplicatedMatches.push(entry);
  });

  const lastPayment = deduplicatedMatches
    .slice()
    .sort((left, right) => right.date.getTime() - left.date.getTime())[0] || null;

  const nextEstimatedFromLastPayment = lastPayment
    ? addPeriod(lastPayment.date, frequency)
    : null;

  let nextEstimatedFromSchedule = null;
  if (startDate) {
    let cursor = new Date(startDate.getTime());
    let guard = 0;
    while (cursor && cursor <= reference && guard < 1000) {
      cursor = addPeriod(cursor, frequency);
      guard += 1;
    }
    nextEstimatedFromSchedule = cursor;
  }

  const nextEstimatedDate = nextEstimatedFromLastPayment || nextEstimatedFromSchedule || null;
  const previousEstimatedDate = nextEstimatedDate ? subtractPeriod(nextEstimatedDate, frequency) : null;

  const status = resolveStatus({ nextEstimatedDate, referenceDate: reference });

  return {
    frequency,
    lastPayment,
    nextEstimatedDate,
    previousEstimatedDate,
    paymentCount: deduplicatedMatches.length,
    status,
  };
}
