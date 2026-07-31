const INCOME_TRANSACTION_TYPES = new Set(["revenu", "income", "recette"]);
const EXPENSE_TRANSACTION_TYPES = new Set(["depense", "dépense", "expense"]);
const LEGACY_TRANSFER_TRANSACTION_TYPES = new Set(["virement", "transfer", "transfert"]);
const ADJUSTMENT_TRANSACTION_TYPES = new Set(["adjustment"]);

function normalizeRawType(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeTransactionType(value) {
  const normalized = normalizeRawType(value);

  if (!normalized) {
    return null;
  }

  if (INCOME_TRANSACTION_TYPES.has(normalized)) {
    return "revenu";
  }

  if (EXPENSE_TRANSACTION_TYPES.has(normalized)) {
    return "depense";
  }

  return null;
}

export function isLegacyTransferLikeType(value) {
  return LEGACY_TRANSFER_TRANSACTION_TYPES.has(normalizeRawType(value));
}

export function getLegacyTransactionType(value) {
  const raw = normalizeRawType(value);
  if (!raw) {
    return "";
  }

  if (normalizeTransactionType(raw) !== null || ADJUSTMENT_TRANSACTION_TYPES.has(raw)) {
    return "";
  }

  return raw;
}

export function isIncomeTransactionType(value) {
  return normalizeTransactionType(value) === "revenu";
}

export function isExpenseTransactionType(value) {
  return normalizeTransactionType(value) === "depense";
}

export function isAdjustmentTransactionType(value) {
  return ADJUSTMENT_TRANSACTION_TYPES.has(normalizeRawType(value));
}

export function normalizeTransactionRecord(transaction) {
  if (!transaction) {
    return transaction;
  }

  const normalizedType = normalizeTransactionType(transaction.type);
  const legacyType = getLegacyTransactionType(transaction.type);

  return {
    ...transaction,
    type: normalizedType || transaction.type || null,
    normalizedType,
    isAdjustment: isAdjustmentTransactionType(transaction.type),
    legacyType,
    needsTypeReview: Boolean(legacyType),
    subcategoryId: transaction.subcategoryId ?? null,
    subcategoryName: transaction.subcategoryName ?? null,
    activityId: transaction.activityId ?? null,
    activityName: transaction.activityName ?? null,
    thirdPartyId: transaction.thirdPartyId ?? null,
    thirdPartyName: transaction.thirdPartyName ?? null,
    projectId: transaction.projectId ?? null,
    projectName: transaction.projectName ?? null,
    workProjectId: transaction.workProjectId ?? null,
    vehicleId: transaction.vehicleId ?? null,
  };
}
