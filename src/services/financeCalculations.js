import { getBudgetPeriodIdentity } from "./budgetModel.js";
function toNumber(value) {
  return Number(value) || 0;
}

function toNormalizedTransactionType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["revenu", "income", "recette"].includes(normalized)) {
    return "revenu";
  }

  if (["depense", "dépense", "expense"].includes(normalized)) {
    return "depense";
  }

  return null;
}

function isAdjustmentTransactionType(value) {
  return String(value || "").trim().toLowerCase() === "adjustment";
}

export function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

export function getTransactionCategoryName(transaction) {
  return transaction?.categoryName || transaction?.categorie || transaction?.category || "";
}

export function toDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedValue)) {
      const [year, month, day] = trimmedValue.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    const parsed = new Date(trimmedValue);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  return null;
}

export function isDateInRange(targetDate, rangeStart, rangeEnd) {
  const target = toDateValue(targetDate);
  if (!target) return false;

  const start = toDateValue(rangeStart);
  const end = toDateValue(rangeEnd);

  if (start && target < start) {
    return false;
  }

  if (end && target > end) {
    return false;
  }

  return true;
}

export function matchesBudgetPeriod(budget, transaction, options = {}) {
  const transactionDate = toDateValue(transaction?.date || transaction?.createdAt || transaction?.timestamp);

  if (!transactionDate) {
    return false;
  }

  const startDate = options.startDate ?? budget?.startDate;
  const endDate = options.endDate ?? budget?.endDate;

  return isDateInRange(transactionDate, startDate, endDate);
}

function areBudgetAndItemAccountsCompatible(budget, item) {
  const budgetAccountId = String(budget?.accountId || "").trim();
  const itemAccountId = String(item?.accountId || "").trim();
  return !budgetAccountId || !itemAccountId || budgetAccountId === itemAccountId;
}

export function isTransactionMatchingBudgetCategory(budget, transaction) {
  const transactionCategoryId = transaction?.categoryId || "";
  const budgetCategoryId = budget?.categoryId || "";
  const transactionCategoryName = normalizeCategoryName(getTransactionCategoryName(transaction));
  const budgetCategoryName = normalizeCategoryName(budget?.categoryName || "");
  const matchesCategory = budgetCategoryId
    ? (transactionCategoryId
      ? transactionCategoryId === budgetCategoryId
      : Boolean(transactionCategoryName && budgetCategoryName && transactionCategoryName === budgetCategoryName))
    : Boolean(transactionCategoryName && budgetCategoryName && transactionCategoryName === budgetCategoryName);

  if (!matchesCategory) return false;

  const budgetSubcategoryId = String(budget?.subcategoryId || "").trim();
  return !budgetSubcategoryId || String(transaction?.subcategoryId || "").trim() === budgetSubcategoryId;
}

export function calculateBudgetReservedFixedExpenseAmount(budget, fixedExpenseOccurrences = []) {
  return (fixedExpenseOccurrences || [])
    .filter((occurrence) => areBudgetAndItemAccountsCompatible(budget, occurrence)
      && isTransactionMatchingBudgetCategory(budget, occurrence))
    .reduce((sum, occurrence) => sum + toNumber(occurrence?.amount ?? occurrence?.montant), 0);
}

function pickMostSpecificBudget(candidates = [], occurrence = {}) {
  const occurrenceAccountId = String(occurrence?.accountId || "").trim();
  return candidates.find((budget) => occurrenceAccountId
    && String(budget?.accountId || "").trim() === occurrenceAccountId) || candidates[0] || null;
}

export function selectNonOverlappingBudgetsForForecast(budgets = []) {
  const groups = new Map();

  (budgets || []).forEach((budget, index) => {
    const categoryIdentity = String(budget?.categoryId || "").trim()
      || normalizeCategoryName(budget?.categoryName || budget?.category || "")
      || `__budget_${budget?.id || index}`;
    const key = [
      String(budget?.accountId || "").trim(),
      categoryIdentity,
      getBudgetPeriodIdentity(budget),
      String(budget?.typeBudget || "depense").trim(),
    ].join("|");
    const group = groups.get(key) || [];
    group.push(budget);
    groups.set(key, group);
  });

  return Array.from(groups.values()).flatMap((group) => {
    const categoryBudgets = group.filter((budget) => !String(budget?.subcategoryId || "").trim());
    if (categoryBudgets.length > 0) {
      return [categoryBudgets[0]];
    }

    const seenSubcategories = new Set();
    return group.filter((budget) => {
      const subcategoryId = String(budget?.subcategoryId || "").trim();
      if (seenSubcategories.has(subcategoryId)) return false;
      seenSubcategories.add(subcategoryId);
      return true;
    });
  });
}

export function buildBudgetFixedExpenseReservationMap(budgets = [], fixedExpenseOccurrences = []) {
  const reservationMap = new Map((budgets || []).map((budget) => [budget, 0]));

  (fixedExpenseOccurrences || []).forEach((occurrence) => {
    const compatibleBudgets = (budgets || []).filter((budget) => (
      areBudgetAndItemAccountsCompatible(budget, occurrence)
      && isTransactionMatchingBudgetCategory({ ...budget, subcategoryId: "" }, occurrence)
    ));
    const occurrenceSubcategoryId = String(occurrence?.subcategoryId || "").trim();
    const exactSubcategoryBudgets = occurrenceSubcategoryId
      ? compatibleBudgets.filter((budget) => String(budget?.subcategoryId || "").trim() === occurrenceSubcategoryId)
      : [];
    const categoryBudgets = compatibleBudgets.filter((budget) => !String(budget?.subcategoryId || "").trim());
    const targetBudget = pickMostSpecificBudget(
      exactSubcategoryBudgets.length > 0 ? exactSubcategoryBudgets : categoryBudgets,
      occurrence
    );

    if (targetBudget) {
      reservationMap.set(targetBudget, toNumber(reservationMap.get(targetBudget))
        + toNumber(occurrence?.amount ?? occurrence?.montant));
    }
  });

  return reservationMap;
}
export function calculateBudgetSpentAmount(budget, transactions = [], options = {}) {
  return (transactions || [])
    .filter((transaction) => {
      if (!transaction || toNormalizedTransactionType(transaction.type) !== "depense") return false;
      if (!isTransactionMatchingBudgetCategory(budget, transaction)) return false;

      return matchesBudgetPeriod(budget, transaction, {
        startDate: options.startDate,
        endDate: options.endDate,
      });
    })
    .reduce((sum, transaction) => sum + toNumber(transaction?.montant ?? transaction?.amount), 0);
}

function buildTransfersByAccountMap(transfers = []) {
  return (transfers || []).reduce((map, transfer) => {
    const sourceAccountId = String(transfer?.sourceAccountId || "");
    const destinationAccountId = String(transfer?.destinationAccountId || "");
    const amount = toNumber(transfer?.amount);

    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId || amount <= 0) {
      return map;
    }

    map[sourceAccountId] = map[sourceAccountId] || { sent: 0, received: 0 };
    map[destinationAccountId] = map[destinationAccountId] || { sent: 0, received: 0 };
    map[sourceAccountId].sent += amount;
    map[destinationAccountId].received += amount;
    return map;
  }, {});
}

export function calculateAccountsBalances(accounts = [], transactions = [], transfers = []) {
  const transferByAccount = buildTransfersByAccountMap(transfers);

  return (accounts || []).map((account) => {
    const accountTransactions = (transactions || []).filter((transaction) => {
      const transactionAccountId = transaction.accountId || "fallback";

      return (
        transactionAccountId === account.id ||
        (!transaction.accountId && account.name === "Compte courant")
      );
    });

    const revenues = accountTransactions
      .filter((transaction) => toNormalizedTransactionType(transaction.type) === "revenu")
      .reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);

    const expenses = accountTransactions
      .filter((transaction) => toNormalizedTransactionType(transaction.type) === "depense")
      .reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);
    const adjustments = accountTransactions
      .filter((transaction) => isAdjustmentTransactionType(transaction.type))
      .reduce((sum, transaction) => sum + toNumber(transaction.montant ?? transaction.amount), 0);

    const transfersSent = toNumber(transferByAccount[account.id]?.sent);
    const transfersReceived = toNumber(transferByAccount[account.id]?.received);

    return {
      ...account,
      balance: toNumber(account.initialBalance) + revenues - expenses + adjustments - transfersSent + transfersReceived,
    };
  });
}

export function calculateCurrentAccountsBalance(accounts = [], transactions = [], transfers = []) {
  const accountBalances = calculateAccountsBalances(accounts, transactions, transfers);
  return accountBalances.reduce((sum, account) => sum + toNumber(account.balance), 0);
}

export function calculateTransfersNetImpact(transfers = []) {
  const validTransfers = (transfers || []).filter((transfer) => {
    const sourceAccountId = String(transfer?.sourceAccountId || "");
    const destinationAccountId = String(transfer?.destinationAccountId || "");
    const amount = toNumber(transfer?.amount);
    return Boolean(sourceAccountId && destinationAccountId && sourceAccountId !== destinationAccountId && amount > 0);
  });

  const sent = validTransfers.reduce((sum, transfer) => sum + toNumber(transfer.amount), 0);
  const received = validTransfers.reduce((sum, transfer) => sum + toNumber(transfer.amount), 0);
  return received - sent;
}

function getExpectedItemCategoryName(expectedItem) {
  return expectedItem?.categoryName || expectedItem?.category || expectedItem?.categorie || "";
}

/**
 * Pure matcher to determine if a transaction satisfies an expected recurring item.
 */
export function matchesExpectedTransaction(transaction, expectedItem, options = {}) {
  if (!transaction || !expectedItem) {
    return false;
  }

  const {
    expectedType,
    expectedAmount,
    monthStart,
    monthEnd,
    amountTolerance = 0.01,
  } = options;

  if (expectedType && transaction.type !== expectedType) {
    return false;
  }

  const transactionDate = toDateValue(transaction?.date || transaction?.createdAt || transaction?.timestamp);
  if (!isDateInRange(transactionDate, monthStart, monthEnd)) {
    return false;
  }

  const explicitRecurringIncomeId = String(transaction?.recurringIncomeId || "").trim();
  if (expectedType === "revenu" && explicitRecurringIncomeId) {
    return Boolean(expectedItem?.id) && explicitRecurringIncomeId === String(expectedItem.id);
  }

  const expectedAccountId = expectedItem?.accountId || "";
  if (expectedAccountId && transaction?.accountId !== expectedAccountId) {
    return false;
  }

  const transactionCategoryId = transaction?.categoryId || "";
  const expectedCategoryId = expectedItem?.categoryId || "";

  if (expectedCategoryId) {
    if (transactionCategoryId) {
      if (transactionCategoryId !== expectedCategoryId) {
        return false;
      }
    } else {
      const transactionCategoryName = normalizeCategoryName(getTransactionCategoryName(transaction));
      const expectedCategoryName = normalizeCategoryName(getExpectedItemCategoryName(expectedItem));

      if (!transactionCategoryName || !expectedCategoryName || transactionCategoryName !== expectedCategoryName) {
        return false;
      }
    }
  } else {
    const expectedCategoryName = normalizeCategoryName(getExpectedItemCategoryName(expectedItem));
    if (expectedCategoryName) {
      const transactionCategoryName = normalizeCategoryName(getTransactionCategoryName(transaction));
      if (!transactionCategoryName || transactionCategoryName !== expectedCategoryName) {
        return false;
      }
    }
  }

  const expectedSubcategoryId = String(expectedItem?.subcategoryId || "").trim();
  const transactionSubcategoryId = String(transaction?.subcategoryId || "").trim();
  if (expectedSubcategoryId && expectedSubcategoryId !== transactionSubcategoryId) {
    return false;
  }

  const expectedAmountValue = Number(expectedAmount);
  if (!Number.isFinite(expectedAmountValue)) {
    return false;
  }

  const transactionAmount = toNumber(transaction?.montant ?? transaction?.amount);
  return Math.abs(transactionAmount - expectedAmountValue) <= amountTolerance;
}

export function findMatchedExpectedItemIds(expectedItems = [], transactions = [], getOptions = () => ({})) {
  const matchedItemIds = new Set();
  const usedTransactionIds = new Set();
  const identifiedItems = expectedItems.filter((item) => item?.id);

  identifiedItems.forEach((item) => {
    const transaction = transactions.find((candidate) => {
      if (!candidate?.id || usedTransactionIds.has(candidate.id)) return false;
      if (String(candidate?.recurringIncomeId || "") !== String(item.id)) return false;
      return matchesExpectedTransaction(candidate, item, getOptions(item));
    });
    if (transaction) {
      matchedItemIds.add(String(item.id));
      usedTransactionIds.add(transaction.id);
    }
  });

  transactions.forEach((transaction) => {
    if (!transaction?.id || usedTransactionIds.has(transaction.id) || transaction?.recurringIncomeId) return;
    const candidates = identifiedItems.filter((item) => (
      !matchedItemIds.has(String(item.id))
      && matchesExpectedTransaction(transaction, item, getOptions(item))
    ));
    if (candidates.length === 1) {
      matchedItemIds.add(String(candidates[0].id));
      usedTransactionIds.add(transaction.id);
    }
  });

  return matchedItemIds;
}
