import {
  isTransactionMatchingBudgetCategory,
  matchesBudgetPeriod,
} from "../services/financeCalculations.js";

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function compareText(left, right) {
  return String(left || "").localeCompare(String(right || ""), "fr", { sensitivity: "base" });
}

export function buildBudgetExplorerRows(budget = {}, transactions = [], accounts = []) {
  const accountMap = new Map((accounts || []).map((account) => [account.id, account.name || ""]));

  return (transactions || [])
    .filter((transaction) => String(transaction?.type || "").toLowerCase() === "depense")
    .filter((transaction) => isTransactionMatchingBudgetCategory(budget, transaction))
    .filter((transaction) => matchesBudgetPeriod(budget, transaction))
    .map((transaction) => ({
      id: transaction.id,
      transaction,
      date: transaction.date || transaction.createdAt || transaction.timestamp || "",
      amount: toAmount(transaction.montant ?? transaction.amount),
      account: transaction.accountName || accountMap.get(transaction.accountId) || transaction.accountId || "Compte inconnu",
      category: transaction.categoryName || transaction.categorie || transaction.category || "Sans catégorie",
      thirdParty: transaction.thirdPartyName || "Sans tiers",
      description: transaction.description || transaction.rawLabel || transaction.label || transaction.id,
      statusLabel: "Utilisée",
    }));
}

export function buildFixedExpenseExplorerRows(summary = null, accounts = []) {
  const accountMap = new Map((accounts || []).map((account) => [account.id, account.name || ""]));
  const occurrences = Array.isArray(summary?.occurrences) ? summary.occurrences : [];

  return occurrences.flatMap((occurrence) => {
    const entries = Array.isArray(occurrence?.transactions) ? occurrence.transactions : [];
    return entries.map((entry, index) => {
      const transaction = entry?.transaction || null;
      const isPrimary = occurrence?.primaryTransaction && transaction?.id === occurrence.primaryTransaction.id;
      const isAnomaly = occurrence?.state === "anomaly";
      const statusLabel = isAnomaly
        ? index === 0
          ? "⚠ Anomalie"
          : "⚠ Anomalie"
        : "Prévision remplacée";

      return {
        id: `${occurrence?.id || "occurrence"}-${transaction?.id || index}`,
        transaction,
        occurrence,
        date: transaction?.date || transaction?.createdAt || transaction?.timestamp || occurrence?.expectedDate || "",
        amount: toAmount(transaction?.montant ?? transaction?.amount ?? occurrence?.accountingValue),
        account: transaction?.accountName || accountMap.get(transaction?.accountId) || transaction?.accountId || "Compte inconnu",
        category: transaction?.categoryName || transaction?.categorie || transaction?.category || occurrence?.fixedExpense?.categoryName || "Sans catégorie",
        thirdParty: transaction?.thirdPartyName || occurrence?.fixedExpense?.thirdPartyName || "Sans tiers",
        description: transaction?.description || transaction?.rawLabel || transaction?.label || transaction?.id || occurrence?.fixedExpense?.name || "Transaction",
        statusLabel,
        statusTone: isAnomaly ? "warning" : isPrimary ? "success" : "warning",
      };
    });
  });
}

export function filterTransactionUsageRows(rows = [], filters = {}) {
  const search = normalizeSearch(filters.searchText);
  const account = String(filters.account || "all");
  const minAmount = filters.minAmount === "" || filters.minAmount == null ? null : toAmount(filters.minAmount);
  const maxAmount = filters.maxAmount === "" || filters.maxAmount == null ? null : toAmount(filters.maxAmount);
  const fromDate = toDateValue(filters.fromDate);
  const toDate = toDateValue(filters.toDate);

  return (rows || []).filter((row) => {
    const rowDate = toDateValue(row?.date);
    if (account !== "all" && String(row?.account || "") !== account) {
      return false;
    }

    if (fromDate && (!rowDate || rowDate < fromDate)) {
      return false;
    }

    if (toDate && (!rowDate || rowDate > toDate)) {
      return false;
    }

    if (minAmount !== null && toAmount(row?.amount) < minAmount) {
      return false;
    }

    if (maxAmount !== null && toAmount(row?.amount) > maxAmount) {
      return false;
    }

    if (!search) {
      return true;
    }

    return [
      row?.description,
      row?.account,
      row?.category,
      row?.thirdParty,
      row?.statusLabel,
    ].some((value) => normalizeSearch(value).includes(search));
  });
}

export function sortTransactionUsageRows(rows = [], sort = {}) {
  const field = sort.field || "date";
  const direction = sort.direction === "asc" ? "asc" : "desc";
  const factor = direction === "asc" ? 1 : -1;

  return [...(rows || [])].sort((left, right) => {
    if (field === "amount") {
      return (toAmount(left?.amount) - toAmount(right?.amount)) * factor;
    }

    if (field === "account") {
      return compareText(left?.account, right?.account) * factor;
    }

    const leftDate = toDateValue(left?.date)?.getTime() || 0;
    const rightDate = toDateValue(right?.date)?.getTime() || 0;
    if (leftDate !== rightDate) {
      return (leftDate - rightDate) * factor;
    }

    return compareText(left?.description, right?.description) * factor;
  });
}

export function buildTransactionUsageTotals(rows = []) {
  return {
    count: (rows || []).length,
    totalAmount: (rows || []).reduce((sum, row) => sum + toAmount(row?.amount), 0),
  };
}
