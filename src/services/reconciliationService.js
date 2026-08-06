import { toDateValue } from "./financeCalculations.js";

export const RECONCILIATION_DECISIONS = Object.freeze({
  AUTO: "auto",
  SUGGEST: "suggest",
  NONE: "none",
});

export const FIXED_EXPENSE_OCCURRENCE_STATES = Object.freeze({
  TRANSACTION: "transaction",
  FORECAST: "forecast",
  ANOMALY: "anomaly",
});

const DEFAULT_FIXED_WEIGHTS = Object.freeze({
  merchant: 0.32,
  account: 0.22,
  date: 0.16,
  periodicity: 0.12,
  amount: 0.1,
  history: 0.08,
});

const DEFAULT_VARIABLE_WEIGHTS = Object.freeze({
  merchant: 0.35,
  account: 0.24,
  date: 0.18,
  periodicity: 0.13,
  amount: 0.03,
  history: 0.07,
});

const DEFAULT_THRESHOLDS = Object.freeze({
  fixed: Object.freeze({ auto: 0.72, suggest: 0.52 }),
  variable: Object.freeze({ auto: 0.7, suggest: 0.5 }),
});

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function addMonths(date, monthCount = 1) {
  const safeDate = toDateValue(date);
  if (!safeDate) return null;

  const day = safeDate.getDate();
  const anchor = new Date(safeDate.getFullYear(), safeDate.getMonth() + monthCount, 1, 12, 0, 0, 0);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, monthEnd));
  return anchor;
}

function addYears(date, yearCount = 1) {
  const safeDate = toDateValue(date);
  if (!safeDate) return null;

  const day = safeDate.getDate();
  const anchor = new Date(safeDate.getFullYear() + yearCount, safeDate.getMonth(), 1, 12, 0, 0, 0);
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, monthEnd));
  return anchor;
}

function addPeriod(date, frequency = "monthly") {
  const safeDate = toDateValue(date);
  if (!safeDate) return null;

  if (frequency === "weekly") {
    return new Date(safeDate.getTime() + (7 * ONE_DAY_MS));
  }

  if (frequency === "annual") {
    return addYears(safeDate, 1);
  }

  return addMonths(safeDate, 1);
}

function toStringValue(value) {
  return String(value || "").trim();
}

function normalizeText(value) {
  return toStringValue(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueTextCandidates(values = []) {
  const result = [];
  const seen = new Set();
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function toMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateDiffInDays(leftDate, rightDate) {
  if (!leftDate || !rightDate) return Number.POSITIVE_INFINITY;
  return Math.abs((leftDate.getTime() - rightDate.getTime()) / ONE_DAY_MS);
}

function buildExpectedOccurrenceDate(fixedExpense = {}, monthStart = null, monthEnd = null) {
  const startDate = toDateValue(fixedExpense?.startDate);
  const monthStartDate = toDateValue(monthStart);
  const monthEndDate = toDateValue(monthEnd);

  if (!monthStartDate || !monthEndDate) return startDate || null;
  if (!startDate) return new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), 1, 12, 0, 0, 0);

  const day = Math.min(startDate.getDate(), monthEndDate.getDate());
  return new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), day, 12, 0, 0, 0);
}

function normalizeFrequency(value) {
  const normalized = normalizeText(value || "monthly");
  if (normalized === "annual" || normalized === "annuel") return "annual";
  if (normalized === "weekly" || normalized === "hebdomadaire") return "weekly";
  return "monthly";
}

function getMonthBounds(date) {
  const safeDate = toDateValue(date);
  if (!safeDate) {
    return { monthStart: null, monthEnd: null };
  }

  return {
    monthStart: new Date(safeDate.getFullYear(), safeDate.getMonth(), 1),
    monthEnd: new Date(safeDate.getFullYear(), safeDate.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

function getFixedExpenseApplicableAmount(fixedExpense = {}, targetDate = null) {
  const baseAmount = toAmount(fixedExpense?.initialAmount ?? fixedExpense?.amount ?? fixedExpense?.baseAmount);
  const variations = Array.isArray(fixedExpense?.variations) ? fixedExpense.variations : [];
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

  return toAmount(latestVariation?.amount ?? baseAmount);
}

function isTransactionCompatibleWithFixedExpense(transaction = {}, fixedExpense = {}) {
  if (!transaction || String(transaction.type || "").toLowerCase() !== "depense") {
    return false;
  }

  const fixedExpenseAccountId = toStringValue(fixedExpense.accountId);
  const transactionAccountId = toStringValue(transaction.accountId);
  if (fixedExpenseAccountId && transactionAccountId && fixedExpenseAccountId !== transactionAccountId) {
    return false;
  }

  const fixedExpenseSubcategoryId = toStringValue(fixedExpense.subcategoryId);
  const transactionSubcategoryId = toStringValue(transaction.subcategoryId);
  if (fixedExpenseSubcategoryId && transactionSubcategoryId && fixedExpenseSubcategoryId !== transactionSubcategoryId) {
    return false;
  }

  return true;
}

function listFixedExpenseOccurrenceDates({ fixedExpense = {}, periodStart = null, periodEnd = null } = {}) {
  const startDate = toDateValue(fixedExpense?.startDate);
  const endDate = toDateValue(fixedExpense?.endDate);
  const rangeStart = toDateValue(periodStart);
  const rangeEnd = toDateValue(periodEnd);
  if (!fixedExpense || fixedExpense.isActive === false || fixedExpense.isDeleted === true) return [];
  if (!startDate || !rangeStart || !rangeEnd || rangeStart > rangeEnd) return [];

  const frequency = normalizeFrequency(fixedExpense.frequency);
  const occurrences = [];
  let cursor = new Date(startDate.getTime());
  let guard = 0;

  while (cursor && cursor <= rangeEnd && guard < 1000) {
    if (!endDate || cursor <= endDate) {
      if (cursor >= rangeStart) {
        occurrences.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0, 0));
      }
    }

    cursor = addPeriod(cursor, frequency);
    guard += 1;
  }

  return occurrences;
}

function rankOccurrenceCandidate(left, right) {
  if (right.explicitRank !== left.explicitRank) {
    return right.explicitRank - left.explicitRank;
  }

  if (right.evaluation.score !== left.evaluation.score) {
    return right.evaluation.score - left.evaluation.score;
  }

  if (left.diffDays !== right.diffDays) {
    return left.diffDays - right.diffDays;
  }

  return left.occurrence.expectedDate.getTime() - right.occurrence.expectedDate.getTime();
}

function buildAuditLabel(state, referenceDate, expectedDate) {
  if (state === FIXED_EXPENSE_OCCURRENCE_STATES.ANOMALY) {
    return "Une anomalie détectée";
  }

  if (state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST) {
    const reference = toDateValue(referenceDate);
    if (reference && expectedDate && expectedDate <= reference) {
      return "Transaction manquante";
    }
    return "Transaction manquante";
  }

  return "Aucun doublon détecté";
}

export function buildFixedExpenseReconciliationLedger({
  fixedExpenses = [],
  transactions = [],
  transactionIndex = null,
  periodStart = null,
  periodEnd = null,
  referenceDate = new Date(),
  leadDays = 12,
  lagDays = 12,
} = {}) {
  const start = toDateValue(periodStart);
  const end = toDateValue(periodEnd);
  if (!start || !end || start > end) {
    return {
      occurrences: [],
      byFixedExpenseId: new Map(),
      byMonth: new Map(),
      summaryByFixedExpenseId: new Map(),
    };
  }

  const safeReferenceDate = toDateValue(referenceDate) || new Date();
  const index = transactionIndex || buildReconciliationTransactionIndex(transactions);
  const safeTransactions = Array.isArray(index?.all) ? index.all : (transactions || []);
  const explicitTransactionsByFixedExpenseId = new Map();
  safeTransactions.forEach((transaction) => {
    const fixedExpenseId = toStringValue(transaction.fixedExpenseId);
    if (!fixedExpenseId) return;
    if (!explicitTransactionsByFixedExpenseId.has(fixedExpenseId)) {
      explicitTransactionsByFixedExpenseId.set(fixedExpenseId, []);
    }
    explicitTransactionsByFixedExpenseId.get(fixedExpenseId).push(transaction);
  });

  const rawOccurrences = (fixedExpenses || []).flatMap((fixedExpense) => {
    const frequency = normalizeFrequency(fixedExpense?.frequency);
    return listFixedExpenseOccurrenceDates({ fixedExpense, periodStart: start, periodEnd: end }).map((expectedDate, occurrenceIndex) => ({
      id: `${toStringValue(fixedExpense?.id) || "fixed-expense"}|${expectedDate.toISOString()}|${occurrenceIndex}`,
      fixedExpenseId: fixedExpense?.id || null,
      fixedExpense,
      expectedDate,
      expectedAmount: getFixedExpenseApplicableAmount(fixedExpense, expectedDate),
      frequency,
      month: toMonthKey(expectedDate),
    }));
  });

  const candidatesByTransactionId = new Map();
  rawOccurrences.forEach((occurrence) => {
    const { monthStart, monthEnd } = getMonthBounds(occurrence.expectedDate);
    const lookupStart = new Date(occurrence.expectedDate.getTime() - (leadDays * ONE_DAY_MS));
    const lookupEnd = new Date(occurrence.expectedDate.getTime() + (lagDays * ONE_DAY_MS));
    const indexedCandidates = getIndexedTransactionsForWindow(index, {
      accountId: occurrence.fixedExpense?.accountId,
      windowStart: lookupStart,
      windowEnd: lookupEnd,
    });
    const explicitCandidates = explicitTransactionsByFixedExpenseId.get(toStringValue(occurrence.fixedExpenseId)) || [];
    const sourceCandidates = [...indexedCandidates, ...explicitCandidates.filter((candidate) => !indexedCandidates.includes(candidate))];

    sourceCandidates.forEach((transaction) => {
      if (!isTransactionCompatibleWithFixedExpense(transaction, occurrence.fixedExpense)) return;

      const transactionDate = toDateValue(transaction?.date || transaction?.operationDate || transaction?.createdAt || transaction?.timestamp);
      if (!transactionDate) return;

      const explicit = toStringValue(transaction.fixedExpenseId) === toStringValue(occurrence.fixedExpenseId);
      const diffDays = dateDiffInDays(transactionDate, occurrence.expectedDate);
      const isEarly = transactionDate < occurrence.expectedDate;
      const inWindow = isEarly ? diffDays <= leadDays : diffDays <= lagDays;
      if (!explicit && !inWindow) return;

      const evaluation = scoreTransactionAgainstFixedExpense(transaction, occurrence.fixedExpense, {
        monthStart,
        monthEnd,
        expectedDate: occurrence.expectedDate,
        expectedAmount: occurrence.expectedAmount,
      });
      if (!explicit && evaluation.decision !== RECONCILIATION_DECISIONS.AUTO) return;

      const transactionId = toStringValue(transaction.id);
      if (!transactionId) return;

      if (!candidatesByTransactionId.has(transactionId)) {
        candidatesByTransactionId.set(transactionId, []);
      }

      candidatesByTransactionId.get(transactionId).push({
        occurrence,
        transaction,
        transactionDate,
        diffDays,
        explicitRank: explicit ? 2 : 1,
        evaluation: explicit
          ? {
            ...evaluation,
            decision: RECONCILIATION_DECISIONS.AUTO,
            score: Math.max(1, evaluation.score),
          }
          : evaluation,
      });
    });
  });

  const preferredCandidatesByOccurrenceId = new Map();
  candidatesByTransactionId.forEach((entries) => {
    entries.sort(rankOccurrenceCandidate);
    const preferred = entries[0];
    if (!preferred) return;
    if (!preferredCandidatesByOccurrenceId.has(preferred.occurrence.id)) {
      preferredCandidatesByOccurrenceId.set(preferred.occurrence.id, []);
    }
    preferredCandidatesByOccurrenceId.get(preferred.occurrence.id).push(preferred);
  });

  const occurrences = rawOccurrences
    .map((occurrence) => {
      const transactionEntries = (preferredCandidatesByOccurrenceId.get(occurrence.id) || [])
        .slice()
        .sort(rankOccurrenceCandidate);
      const primaryEntry = transactionEntries[0] || null;
      const state = transactionEntries.length === 0
        ? FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST
        : transactionEntries.length === 1
          ? FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION
          : FIXED_EXPENSE_OCCURRENCE_STATES.ANOMALY;

      return {
        ...occurrence,
        state,
        auditLabel: buildAuditLabel(state, safeReferenceDate, occurrence.expectedDate),
        accountingSource: state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST ? "forecast" : "transaction",
        accountingValue: state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST
          ? occurrence.expectedAmount
          : toAmount(primaryEntry?.transaction?.montant ?? primaryEntry?.transaction?.amount),
        amountDelta: state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST
          ? 0
          : toAmount(primaryEntry?.transaction?.montant ?? primaryEntry?.transaction?.amount) - occurrence.expectedAmount,
        replacedForecast: state !== FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST,
        transactionCount: transactionEntries.length,
        transactions: transactionEntries.map((entry) => ({
          transaction: entry.transaction,
          transactionDate: entry.transactionDate,
          score: entry.evaluation.score,
          decision: entry.evaluation.decision,
          explicit: entry.explicitRank === 2,
        })),
        primaryTransaction: primaryEntry?.transaction || null,
        primaryTransactionDate: primaryEntry?.transactionDate || null,
        anomalyTransactions: transactionEntries.slice(1).map((entry) => entry.transaction),
      };
    })
    .sort((left, right) => left.expectedDate.getTime() - right.expectedDate.getTime());

  const byFixedExpenseId = new Map();
  const byMonth = new Map();
  occurrences.forEach((occurrence) => {
    const fixedExpenseId = toStringValue(occurrence.fixedExpenseId);
    if (!byFixedExpenseId.has(fixedExpenseId)) {
      byFixedExpenseId.set(fixedExpenseId, []);
    }
    byFixedExpenseId.get(fixedExpenseId).push(occurrence);

    if (!byMonth.has(occurrence.month)) {
      byMonth.set(occurrence.month, []);
    }
    byMonth.get(occurrence.month).push(occurrence);
  });

  const summaryByFixedExpenseId = new Map();
  byFixedExpenseId.forEach((fixedExpenseOccurrences, fixedExpenseId) => {
    const transactionCount = fixedExpenseOccurrences.reduce((sum, occurrence) => sum + occurrence.transactionCount, 0);
    const forecastCount = fixedExpenseOccurrences.filter((occurrence) => occurrence.state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST).length;
    const anomalyCount = fixedExpenseOccurrences.filter((occurrence) => occurrence.state === FIXED_EXPENSE_OCCURRENCE_STATES.ANOMALY).length;
    const coveredOccurrenceCount = fixedExpenseOccurrences.filter((occurrence) => occurrence.state !== FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST).length;
    const auditLabel = anomalyCount > 0
      ? "Une anomalie détectée"
      : forecastCount > 0
        ? "Transaction manquante"
        : "Aucun doublon détecté";

    summaryByFixedExpenseId.set(fixedExpenseId, {
      fixedExpenseId: fixedExpenseOccurrences[0]?.fixedExpenseId || null,
      fixedExpense: fixedExpenseOccurrences[0]?.fixedExpense || null,
      occurrenceCount: fixedExpenseOccurrences.length,
      transactionCount,
      forecastCount,
      anomalyCount,
      coveredOccurrenceCount,
      linkedTransactionCount: transactionCount,
      remainingOccurrences: forecastCount,
      auditLabel,
      occurrences: fixedExpenseOccurrences,
    });
  });

  return {
    occurrences,
    byFixedExpenseId,
    byMonth,
    summaryByFixedExpenseId,
  };
}

function scoreMerchant(transaction = {}, fixedExpense = {}) {
  const transactionCandidates = uniqueTextCandidates([
    transaction.thirdPartyName,
    transaction.merchant,
    transaction.description,
    transaction.rawLabel,
    transaction.label,
  ]);
  const fixedExpenseCandidates = uniqueTextCandidates([
    fixedExpense.thirdPartyName,
    fixedExpense.name,
  ]);

  if (!transactionCandidates.length || !fixedExpenseCandidates.length) return 0;

  let bestScore = 0;
  transactionCandidates.forEach((transactionLabel) => {
    fixedExpenseCandidates.forEach((fixedExpenseLabel) => {
      if (transactionLabel === fixedExpenseLabel) {
        bestScore = Math.max(bestScore, 1);
        return;
      }

      if (transactionLabel.includes(fixedExpenseLabel) || fixedExpenseLabel.includes(transactionLabel)) {
        bestScore = Math.max(bestScore, 0.72);
        return;
      }

      const transactionTokens = new Set(transactionLabel.split(/[^a-z0-9]+/g).filter(Boolean));
      const fixedExpenseTokens = new Set(fixedExpenseLabel.split(/[^a-z0-9]+/g).filter(Boolean));
      if (!transactionTokens.size || !fixedExpenseTokens.size) return;

      let sharedCount = 0;
      transactionTokens.forEach((token) => {
        if (fixedExpenseTokens.has(token)) sharedCount += 1;
      });
      if (!sharedCount) return;

      const overlapScore = sharedCount / Math.max(transactionTokens.size, fixedExpenseTokens.size);
      bestScore = Math.max(bestScore, overlapScore);
    });
  });

  return Math.min(1, bestScore);
}

function scoreAccount(transaction = {}, fixedExpense = {}) {
  const transactionAccountId = toStringValue(transaction.accountId);
  const fixedExpenseAccountId = toStringValue(fixedExpense.accountId);
  if (!transactionAccountId || !fixedExpenseAccountId) return 0;
  return transactionAccountId === fixedExpenseAccountId ? 1 : 0;
}

function scoreHistory(transaction = {}, fixedExpense = {}) {
  const transactionFixedExpenseId = toStringValue(transaction.fixedExpenseId);
  const fixedExpenseId = toStringValue(fixedExpense.id);
  if (!transactionFixedExpenseId || !fixedExpenseId) return 0;
  return transactionFixedExpenseId === fixedExpenseId ? 1 : 0;
}

function scoreDateProximity(transactionDate = null, expectedDate = null) {
  const daysDiff = dateDiffInDays(transactionDate, expectedDate);
  if (!Number.isFinite(daysDiff)) return 0;

  if (daysDiff <= 2) return 1;
  if (daysDiff <= 5) return 0.85;
  if (daysDiff <= 10) return 0.6;
  if (daysDiff <= 20) return 0.35;
  return 0;
}

function scorePeriodicity(transactionDate = null, fixedExpense = {}, expectedDate = null) {
  const frequency = normalizeText(fixedExpense.frequency || "monthly");
  if (!transactionDate || !expectedDate) return 0;

  const dayGap = dateDiffInDays(transactionDate, expectedDate);
  if (!Number.isFinite(dayGap)) return 0;

  if (frequency === "annual" || frequency === "annuel") {
    return dayGap <= 31 ? 1 : dayGap <= 45 ? 0.5 : 0;
  }

  return dayGap <= 12 ? 1 : dayGap <= 20 ? 0.55 : 0;
}

function scoreAmount(transaction = {}, fixedExpense = {}, amountType = "fixed", expectedAmount = null) {
  const transactionAmount = toAmount(transaction.montant ?? transaction.amount);
  const amountReference = Number.isFinite(Number(expectedAmount))
    ? toAmount(expectedAmount)
    : toAmount(fixedExpense.initialAmount ?? fixedExpense.amount);

  if (transactionAmount <= 0 || amountReference <= 0) return 0;

  const relativeDelta = Math.abs(transactionAmount - amountReference) / amountReference;
  if (amountType === "variable") {
    if (relativeDelta <= 0.05) return 1;
    if (relativeDelta <= 0.2) return 0.9;
    if (relativeDelta <= 0.5) return 0.7;
    if (relativeDelta <= 1) return 0.35;
    return 0;
  }

  if (relativeDelta <= 0.02) return 1;
  if (relativeDelta <= 0.08) return 0.7;
  if (relativeDelta <= 0.15) return 0.45;
  return 0;
}

function resolveAmountType(fixedExpense = {}) {
  const normalized = normalizeText(fixedExpense.amountType || fixedExpense.type || "fixed");
  if (normalized === "variable") return "variable";
  return "fixed";
}

function resolveWeights(amountType = "fixed", overrides = {}) {
  const source = amountType === "variable" ? DEFAULT_VARIABLE_WEIGHTS : DEFAULT_FIXED_WEIGHTS;
  return {
    merchant: Number(overrides.merchant ?? source.merchant),
    account: Number(overrides.account ?? source.account),
    date: Number(overrides.date ?? source.date),
    periodicity: Number(overrides.periodicity ?? source.periodicity),
    amount: Number(overrides.amount ?? source.amount),
    history: Number(overrides.history ?? source.history),
  };
}

function resolveThresholds(amountType = "fixed", overrides = {}) {
  const source = amountType === "variable" ? DEFAULT_THRESHOLDS.variable : DEFAULT_THRESHOLDS.fixed;
  return {
    auto: Number(overrides.auto ?? source.auto),
    suggest: Number(overrides.suggest ?? source.suggest),
  };
}

export function classifyReconciliationScore(score, { amountType = "fixed", thresholds = {} } = {}) {
  const resolvedThresholds = resolveThresholds(amountType, thresholds);
  if (score >= resolvedThresholds.auto) return RECONCILIATION_DECISIONS.AUTO;
  if (score >= resolvedThresholds.suggest) return RECONCILIATION_DECISIONS.SUGGEST;
  return RECONCILIATION_DECISIONS.NONE;
}

export function scoreTransactionAgainstFixedExpense(transaction = {}, fixedExpense = {}, options = {}) {
  const transactionDate = toDateValue(transaction?.date || transaction?.operationDate || transaction?.createdAt || transaction?.timestamp);
  const monthStart = toDateValue(options.monthStart);
  const monthEnd = toDateValue(options.monthEnd);
  const expectedDate = options.expectedDate
    ? toDateValue(options.expectedDate)
    : buildExpectedOccurrenceDate(fixedExpense, monthStart, monthEnd);
  const amountType = resolveAmountType(fixedExpense);
  const weights = resolveWeights(amountType, options.weights || {});

  const criteria = {
    merchant: scoreMerchant(transaction, fixedExpense),
    account: scoreAccount(transaction, fixedExpense),
    date: scoreDateProximity(transactionDate, expectedDate),
    periodicity: scorePeriodicity(transactionDate, fixedExpense, expectedDate),
    amount: scoreAmount(transaction, fixedExpense, amountType, options.expectedAmount),
    history: scoreHistory(transaction, fixedExpense),
  };

  const score = (criteria.merchant * weights.merchant)
    + (criteria.account * weights.account)
    + (criteria.date * weights.date)
    + (criteria.periodicity * weights.periodicity)
    + (criteria.amount * weights.amount)
    + (criteria.history * weights.history);

  const decision = classifyReconciliationScore(score, {
    amountType,
    thresholds: options.thresholds || {},
  });

  return {
    decision,
    score,
    amountType,
    criteria,
    expectedDate,
    weights,
  };
}

export function buildReconciliationTransactionIndex(transactions = []) {
  const byAccountAndMonth = new Map();
  const all = [];

  (transactions || []).forEach((transaction) => {
    if (!transaction || transaction.isDeleted === true || String(transaction.type || "").toLowerCase() !== "depense") {
      return;
    }

    const date = toDateValue(transaction.date || transaction.operationDate || transaction.createdAt || transaction.timestamp);
    if (!date) return;

    const normalized = { ...transaction, __date: date };
    all.push(normalized);

    const accountId = toStringValue(transaction.accountId) || "__any__";
    const monthKey = toMonthKey(date);
    const key = `${accountId}|${monthKey}`;
    if (!byAccountAndMonth.has(key)) byAccountAndMonth.set(key, []);
    byAccountAndMonth.get(key).push(normalized);
  });

  return { byAccountAndMonth, all };
}

export function getIndexedTransactionsForWindow(index = null, {
  accountId = "",
  windowStart = null,
  windowEnd = null,
} = {}) {
  const start = toDateValue(windowStart);
  const end = toDateValue(windowEnd);
  if (!index || !start || !end) return [];

  const accountKey = toStringValue(accountId) || "__any__";
  const monthKeys = new Set([
    `${accountKey}|${toMonthKey(start)}`,
    `${accountKey}|${toMonthKey(end)}`,
  ]);

  const candidates = [];
  monthKeys.forEach((key) => {
    (index.byAccountAndMonth.get(key) || []).forEach((transaction) => {
      if (transaction.__date >= start && transaction.__date <= end) {
        candidates.push(transaction);
      }
    });
  });

  return candidates;
}

export function evaluateFixedExpenseOccurrenceCoverage({
  fixedExpense = {},
  transactions = [],
  transactionIndex = null,
  monthStart = null,
  monthEnd = null,
  expectedAmount = null,
  leadDays = 7,
  lagDays = 7,
  includeSuggestAsCovered = false,
} = {}) {
  const start = toDateValue(monthStart);
  const end = toDateValue(monthEnd);
  if (!start || !end) {
    return {
      covered: false,
      decision: RECONCILIATION_DECISIONS.NONE,
      bestMatch: null,
      suggestions: [],
    };
  }

  const fixedExpenseId = toStringValue(fixedExpense.id);
  const explicitLinked = (transactions || []).find((transaction) => {
    if (toStringValue(transaction.fixedExpenseId) !== fixedExpenseId) return false;
    const transactionDate = toDateValue(transaction.date || transaction.operationDate || transaction.createdAt || transaction.timestamp);
    return transactionDate && transactionDate >= start && transactionDate <= end;
  });

  if (explicitLinked) {
    return {
      covered: true,
      decision: RECONCILIATION_DECISIONS.AUTO,
      bestMatch: {
        transaction: explicitLinked,
        evaluation: {
          decision: RECONCILIATION_DECISIONS.AUTO,
          score: 1,
          amountType: resolveAmountType(fixedExpense),
          criteria: {
            merchant: 1,
            account: 1,
            date: 1,
            periodicity: 1,
            amount: 1,
            history: 1,
          },
        },
      },
      suggestions: [],
    };
  }

  const lookupStart = new Date(start.getTime() - (leadDays * ONE_DAY_MS));
  const lookupEnd = new Date(end.getTime() + (lagDays * ONE_DAY_MS));
  const indexedCandidates = getIndexedTransactionsForWindow(transactionIndex, {
    accountId: fixedExpense.accountId,
    windowStart: lookupStart,
    windowEnd: lookupEnd,
  });
  const sourceCandidates = indexedCandidates.length > 0 ? indexedCandidates : (transactions || []);

  const compatibleCandidates = sourceCandidates.filter((transaction) => {
    if (!transaction) return false;
    if (String(transaction.type || "").toLowerCase() !== "depense") return false;

    const transactionDate = toDateValue(transaction.date || transaction.operationDate || transaction.createdAt || transaction.timestamp);
    if (!transactionDate || transactionDate < lookupStart || transactionDate > lookupEnd) return false;

    const fixedExpenseAccountId = toStringValue(fixedExpense.accountId);
    const transactionAccountId = toStringValue(transaction.accountId);
    if (fixedExpenseAccountId && transactionAccountId && fixedExpenseAccountId !== transactionAccountId) return false;

    const fixedExpenseSubcategoryId = toStringValue(fixedExpense.subcategoryId);
    const transactionSubcategoryId = toStringValue(transaction.subcategoryId);
    if (fixedExpenseSubcategoryId && fixedExpenseSubcategoryId !== transactionSubcategoryId) return false;

    return true;
  });

  const evaluated = compatibleCandidates.map((transaction) => ({
    transaction,
    evaluation: scoreTransactionAgainstFixedExpense(transaction, fixedExpense, {
      monthStart,
      monthEnd,
      expectedAmount,
    }),
  }));

  evaluated.sort((left, right) => right.evaluation.score - left.evaluation.score);
  const bestMatch = evaluated[0] || null;
  const suggestions = evaluated.filter((entry) => entry.evaluation.decision === RECONCILIATION_DECISIONS.SUGGEST);
  const coveredByScore = bestMatch
    ? (bestMatch.evaluation.decision === RECONCILIATION_DECISIONS.AUTO
      || (includeSuggestAsCovered && bestMatch.evaluation.decision === RECONCILIATION_DECISIONS.SUGGEST))
    : false;

  return {
    covered: coveredByScore,
    decision: bestMatch?.evaluation?.decision || RECONCILIATION_DECISIONS.NONE,
    bestMatch,
    suggestions,
  };
}

export function summarizeFixedExpenseReconciliation({
  fixedExpense = {},
  transactions = [],
  year,
  referenceDate = new Date(),
} = {}) {
  const targetYear = Number.isFinite(Number(year)) ? Number(year) : referenceDate.getFullYear();
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: fixedExpense ? [fixedExpense] : [],
    transactions,
    periodStart: new Date(targetYear, 0, 1),
    periodEnd: new Date(targetYear, 11, 31, 23, 59, 59, 999),
    referenceDate,
  });
  const summary = ledger.summaryByFixedExpenseId.get(toStringValue(fixedExpense.id));

  return summary || {
    fixedExpenseId: fixedExpense.id || null,
    fixedExpense,
    occurrenceCount: 0,
    transactionCount: 0,
    forecastCount: 0,
    anomalyCount: 0,
    coveredOccurrenceCount: 0,
    linkedTransactionCount: 0,
    remainingOccurrences: 0,
    auditLabel: "Aucun doublon détecté",
    occurrences: [],
  };
}
