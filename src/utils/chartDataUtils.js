import { normalizeTransactionType } from "./transactionTypeUtils.js";

function toAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeCategoryName(value) {
  const cleaned = String(value || "").trim();
  return cleaned || "Sans categorie";
}

function formatWeekLabel(index) {
  return `S${index + 1}`;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function calculateSharePercentages(items = []) {
  const total = items.reduce((sum, item) => sum + toAmount(item?.amount), 0);

  if (total <= 0) {
    return items.map((item) => ({ ...item, percent: 0 }));
  }

  return items.map((item) => ({
    ...item,
    percent: (toAmount(item?.amount) / total) * 100,
  }));
}

export function mergeSmallCategories(items = [], maxCategories = 6, othersLabel = "Autres") {
  const sorted = [...items].sort((left, right) => toAmount(right?.amount) - toAmount(left?.amount));
  if (sorted.length <= maxCategories) {
    return sorted;
  }

  const keepCount = Math.max(1, maxCategories - 1);
  const kept = sorted.slice(0, keepCount);
  const othersItems = sorted.slice(keepCount);
  const othersAmount = othersItems.reduce((sum, item) => sum + toAmount(item?.amount), 0);
  const othersCount = othersItems.reduce((sum, item) => sum + Number(item?.count || 0), 0);

  const categoryIds = Array.from(new Set(othersItems.flatMap((item) => (Array.isArray(item?.categoryIds) ? item.categoryIds : []))));
  const transactionIds = Array.from(new Set(othersItems.flatMap((item) => (Array.isArray(item?.transactionIds) ? item.transactionIds : []))));
  const sourceNames = Array.from(new Set(othersItems.flatMap((item) => (Array.isArray(item?.sourceNames) ? item.sourceNames : []))));

  return [...kept, {
    name: othersLabel,
    amount: othersAmount,
    count: othersCount,
    categoryIds,
    transactionIds,
    sourceNames,
  }];
}

export function buildMonthlyExpenseCategoryData(transactions = [], options = {}) {
  return buildMonthlyCategoryData(transactions, {
    ...options,
    expectedType: "depense",
  });
}

export function buildMonthlyIncomeCategoryData(transactions = [], options = {}) {
  return buildMonthlyCategoryData(transactions, {
    ...options,
    expectedType: "revenu",
  });
}

function buildMonthlyCategoryData(transactions = [], options = {}) {
  const monthDate = options.monthDate ? parseDate(options.monthDate) : new Date();
  const monthKey = getMonthKey(monthDate || new Date());
  const maxCategories = options.maxCategories || 6;
  const expectedType = options.expectedType || "depense";

  const grouped = (transactions || []).reduce((accumulator, transaction) => {
    if (!transaction || normalizeTransactionType(transaction.type) !== expectedType) {
      return accumulator;
    }

    const transactionDate = parseDate(transaction.date);
    if (!transactionDate || getMonthKey(transactionDate) !== monthKey) {
      return accumulator;
    }

    const categoryName = normalizeCategoryName(transaction.categoryName || transaction.categorie);
    accumulator[categoryName] = (accumulator[categoryName] || 0) + toAmount(transaction.montant);
    return accumulator;
  }, {});

  const base = Object.entries(grouped).map(([name, amount]) => ({ name, amount }));
  const merged = mergeSmallCategories(base, maxCategories);
  const withPercent = calculateSharePercentages(merged);
  const total = withPercent.reduce((sum, item) => sum + toAmount(item.amount), 0);

  return {
    monthKey,
    total,
    categories: withPercent,
  };
}

export function buildBudgetComparisonData(items = []) {
  return (items || []).map((item) => {
    const planned = toAmount(item?.plannedAmount);
    const spent = toAmount(item?.spentAmount);

    return {
      id: item?.id || item?.name,
      name: normalizeCategoryName(item?.name),
      planned,
      spent,
      delta: planned - spent,
      overrun: spent > planned,
      ratio: planned > 0 ? Math.min((spent / planned) * 100, 100) : 0,
    };
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
  };
}

function getPreviousMonthRange() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    year: previous.getFullYear(),
    month: previous.getMonth(),
  };
}

function bucketWeekInMonth(date) {
  return Math.min(4, Math.floor((date.getDate() - 1) / 7));
}

export function buildIncomeExpenseTrendData(transactions = [], period = "currentMonth") {
  if (period === "currentYear") {
    const year = new Date().getFullYear();
    const labels = ["Jan", "Fev", "Mar", "Avr", "Mai", "Juin", "Juil", "Aou", "Sep", "Oct", "Nov", "Dec"];
    const rows = labels.map((label, index) => ({
      label,
      revenu: 0,
      depense: 0,
      index,
    }));

    (transactions || []).forEach((transaction) => {
      const date = parseDate(transaction?.date);
      if (!date || date.getFullYear() !== year) {
        return;
      }

      const month = date.getMonth();
      if (normalizeTransactionType(transaction.type) === "revenu") {
        rows[month].revenu += toAmount(transaction.montant);
      }

      if (normalizeTransactionType(transaction.type) === "depense") {
        rows[month].depense += toAmount(transaction.montant);
      }
    });

    return rows;
  }

  const target = period === "previousMonth" ? getPreviousMonthRange() : getCurrentMonthRange();
  const rows = Array.from({ length: 5 }, (_, index) => ({
    label: formatWeekLabel(index),
    revenu: 0,
    depense: 0,
    index,
  }));

  (transactions || []).forEach((transaction) => {
    const date = parseDate(transaction?.date);
    if (!date) {
      return;
    }

    if (date.getFullYear() !== target.year || date.getMonth() !== target.month) {
      return;
    }

    const weekBucket = bucketWeekInMonth(date);
    if (normalizeTransactionType(transaction.type) === "revenu") {
      rows[weekBucket].revenu += toAmount(transaction.montant);
    }

    if (normalizeTransactionType(transaction.type) === "depense") {
      rows[weekBucket].depense += toAmount(transaction.montant);
    }
  });

  return rows;
}
