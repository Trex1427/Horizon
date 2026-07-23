import {
  CASH_ADJUSTMENT_KINDS,
  CASH_ADJUSTMENT_LABEL,
  CASH_ADJUSTMENT_TYPE,
} from "../constants/cashBalanceConstants.js";

function roundCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function parseCashAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? roundCents(value) : null;
  }

  const normalized = String(value || "").trim().replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? roundCents(amount) : null;
}

export function toIsoDateString(value = new Date()) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calculateCashAdjustmentDelta(currentBalance, targetBalance) {
  const current = parseCashAmount(currentBalance);
  const target = parseCashAmount(targetBalance);

  if (current === null || target === null) {
    return null;
  }

  return roundCents(target - current);
}

export function hasCashAccountHistory(accountId, transactions = [], transfers = []) {
  const normalizedAccountId = String(accountId || "");
  if (!normalizedAccountId) return false;

  const hasTransactionHistory = (transactions || []).some((transaction) => (
    transaction?.isDeleted !== true
    && String(transaction?.accountId || "") === normalizedAccountId
  ));

  const hasTransferHistory = (transfers || []).some((transfer) => (
    transfer?.isActive !== false
    && (
      String(transfer?.sourceAccountId || "") === normalizedAccountId
      || String(transfer?.destinationAccountId || "") === normalizedAccountId
    )
  ));

  return hasTransactionHistory || hasTransferHistory;
}

export function isCashAdjustmentTransaction(transaction = {}) {
  return String(transaction?.type || "").trim().toLowerCase() === CASH_ADJUSTMENT_TYPE;
}

export function buildCashAdjustmentId({ accountId, date, targetBalance, kind }) {
  const targetCents = Math.round((parseCashAmount(targetBalance) || 0) * 100);
  return [
    CASH_ADJUSTMENT_TYPE,
    String(accountId || "").trim(),
    toIsoDateString(date),
    kind === CASH_ADJUSTMENT_KINDS.opening ? CASH_ADJUSTMENT_KINDS.opening : CASH_ADJUSTMENT_KINDS.balance,
    targetCents,
  ].join("_").replace(/[^a-zA-Z0-9_-]/g, "-");
}

export function buildCashAdjustmentPayload({
  accountId,
  currentBalance,
  targetBalance,
  date = new Date(),
  reason = "",
  kind = CASH_ADJUSTMENT_KINDS.balance,
  now = new Date(),
} = {}) {
  const normalizedAccountId = String(accountId || "").trim();
  const normalizedTargetBalance = parseCashAmount(targetBalance);
  const normalizedCurrentBalance = parseCashAmount(currentBalance);
  const adjustmentAmount = calculateCashAdjustmentDelta(normalizedCurrentBalance, normalizedTargetBalance);
  const normalizedKind = kind === CASH_ADJUSTMENT_KINDS.opening
    ? CASH_ADJUSTMENT_KINDS.opening
    : CASH_ADJUSTMENT_KINDS.balance;

  if (!normalizedAccountId) {
    throw new Error("Le compte Espèces est introuvable.");
  }

  if (normalizedTargetBalance === null || normalizedCurrentBalance === null || adjustmentAmount === null) {
    throw new Error("Le solde réel doit être un montant valide.");
  }

  if (adjustmentAmount === 0) {
    throw new Error("Le solde Horizon correspond déjà au solde réel.");
  }

  return {
    accountId: normalizedAccountId,
    type: CASH_ADJUSTMENT_TYPE,
    montant: adjustmentAmount,
    amount: adjustmentAmount,
    date: toIsoDateString(date),
    description: CASH_ADJUSTMENT_LABEL,
    categoryId: null,
    categoryName: "",
    categorie: "",
    subcategoryId: null,
    subcategoryName: null,
    activityId: null,
    activityName: null,
    thirdPartyId: null,
    thirdPartyName: null,
    projectId: null,
    projectName: null,
    destinationAccountId: null,
    adjustmentKind: normalizedKind,
    targetBalance: normalizedTargetBalance,
    theoreticalBalance: normalizedCurrentBalance,
    adjustmentReason: String(reason || "").trim(),
    createdAt: now,
    updatedAt: now,
  };
}
