function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.trim().split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateString(value) {
  const dateValue = toDateValue(value);
  if (!dateValue) return null;
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeEnvelopeValue(value) {
  return String(value || "").trim();
}

export function buildBudgetWritePayload(safePayload = {}) {
  return {
    name: safePayload.name?.trim() || "",
    categoryId: normalizeEnvelopeValue(safePayload.categoryId),
    categoryName: safePayload.categoryName?.trim() || "",
    subcategoryId: normalizeEnvelopeValue(safePayload.subcategoryId) || null,
    subcategoryName: safePayload.subcategoryId ? (safePayload.subcategoryName?.trim() || null) : null,
    accountId: normalizeEnvelopeValue(safePayload.accountId) || null,
    amount: Number(safePayload.amount || 0),
    startDate: normalizeDateString(safePayload.startDate) || null,
    endDate: normalizeDateString(safePayload.endDate) || null,
    typeBudget: safePayload.typeBudget || "depense",
    periodType: safePayload.periodType || "mensuel",
  };
}

export function getBudgetPeriodIdentity(budget = {}) {
  const periodType = normalizeEnvelopeValue(budget?.periodType || "mensuel").toLowerCase();
  const startDate = normalizeDateString(budget?.startDate);
  if (!startDate) {
    return [periodType, normalizeEnvelopeValue(budget?.startDate), normalizeEnvelopeValue(budget?.endDate)].join("|");
  }

  const periodStart = ["annuel", "annual", "yearly"].includes(periodType)
    ? startDate.slice(0, 4)
    : startDate.slice(0, 7);
  return `${periodType}|${periodStart}`;
}

export function areBudgetsSameEnvelope(left = {}, right = {}) {
  return normalizeEnvelopeValue(left.accountId) === normalizeEnvelopeValue(right.accountId)
    && normalizeEnvelopeValue(left.categoryId) === normalizeEnvelopeValue(right.categoryId)
    && normalizeEnvelopeValue(left.subcategoryId) === normalizeEnvelopeValue(right.subcategoryId)
    && getBudgetPeriodIdentity(left) === getBudgetPeriodIdentity(right)
    && normalizeEnvelopeValue(left.typeBudget || "depense") === normalizeEnvelopeValue(right.typeBudget || "depense");
}

export function findDuplicateBudgetEnvelope(budgets = [], candidate = {}, excludeId = "") {
  return (budgets || []).find((budget) => budget?.isActive !== false
    && String(budget?.id || "") !== String(excludeId || "")
    && areBudgetsSameEnvelope(budget, candidate)) || null;
}
