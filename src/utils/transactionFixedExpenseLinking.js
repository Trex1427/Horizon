import { matchesExpectedTransaction } from "../services/financeCalculations.js";

function toDateValue(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getMonthRange(value) {
  const date = toDateValue(value);
  if (!date) {
    return null;
  }

  return {
    monthStart: new Date(date.getFullYear(), date.getMonth(), 1),
    monthEnd: new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999),
  };
}

export function getFixedExpenseApplicableAmount(fixedExpense = {}, referenceDate = null) {
  const baseAmount = Number(fixedExpense?.initialAmount || 0);
  const variations = Array.isArray(fixedExpense?.variations) ? fixedExpense.variations : [];
  const targetDate = toDateValue(referenceDate);

  if (!targetDate || variations.length === 0) {
    return Number.isFinite(baseAmount) ? Math.abs(baseAmount) : 0;
  }

  const latestVariation = variations
    .filter((variation) => {
      const effectiveDate = toDateValue(variation?.effectiveDate);
      return effectiveDate && effectiveDate <= targetDate;
    })
    .sort((left, right) => {
      const leftDate = toDateValue(left?.effectiveDate);
      const rightDate = toDateValue(right?.effectiveDate);
      return (rightDate?.getTime?.() || 0) - (leftDate?.getTime?.() || 0);
    })[0];

  const resolvedAmount = Number(latestVariation?.amount ?? baseAmount);
  if (!Number.isFinite(resolvedAmount)) {
    return 0;
  }

  return Math.abs(resolvedAmount);
}

export function findMatchingFixedExpenseForTransaction(transaction = {}, fixedExpenses = []) {
  if (!transaction || String(transaction?.type || "").toLowerCase() !== "depense") {
    return null;
  }

  const monthRange = getMonthRange(transaction?.date || transaction?.createdAt || transaction?.updatedAt);
  if (!monthRange) {
    return null;
  }

  const candidates = Array.isArray(fixedExpenses) ? fixedExpenses : [];
  const linkedFixedExpenseId = String(transaction?.fixedExpenseId || "").trim();
  if (linkedFixedExpenseId) {
    const linkedFixedExpense = candidates.find((fixedExpense) => fixedExpense?.id === linkedFixedExpenseId && fixedExpense?.isActive !== false);
    if (linkedFixedExpense) return linkedFixedExpense;
  }

  for (const fixedExpense of candidates) {
    const expectedAmount = getFixedExpenseApplicableAmount(fixedExpense, monthRange.monthEnd);

    if (expectedAmount <= 0) {
      continue;
    }

    const isMatch = matchesExpectedTransaction(
      transaction,
      {
        accountId: fixedExpense?.accountId || "",
        categoryId: fixedExpense?.categoryId || "",
        categoryName: fixedExpense?.categoryName || fixedExpense?.category || "",
      },
      {
        expectedType: "depense",
        expectedAmount,
        monthStart: monthRange.monthStart,
        monthEnd: monthRange.monthEnd,
      }
    );

    if (isMatch) {
      return fixedExpense;
    }
  }

  return null;
}

export function applyFixedExpenseToTransactionForm(form = {}, fixedExpense = {}, referenceDate = null) {
  const resolvedAmount = getFixedExpenseApplicableAmount(fixedExpense, referenceDate || form?.date);
  const categoryName = fixedExpense?.categoryName || fixedExpense?.category || "";

  return {
    ...form,
    type: "depense",
    montant: resolvedAmount > 0 ? String(resolvedAmount) : form?.montant,
    categorie: categoryName,
    categoryName,
    categoryId: fixedExpense?.categoryId || "",
    accountId: fixedExpense?.accountId || form?.accountId || "",
    isFixedExpense: true,
    fixedExpenseId: fixedExpense?.id || "",
  };
}

export function buildQuickFixedExpensePayload(form = {}, draft = {}) {
  const categoryName = String(form?.categoryName || form?.categorie || "").trim();

  return {
    name: String(draft?.name || "").trim(),
    categoryId: form?.categoryId || "",
    categoryName,
    category: categoryName,
    accountId: form?.accountId || "",
    subcategoryId: form?.subcategoryId || "",
    thirdPartyId: form?.thirdPartyId || "",
    activityId: form?.activityId || "",
    projectId: form?.projectId || "",
    frequency: draft?.frequency || "monthly",
    initialAmount: Number(form?.montant || 0),
    startDate: draft?.startDate || form?.date || null,
    endDate: draft?.endDate || null,
    description: String(draft?.description || "").trim(),
    variations: [],
    isActive: true,
  };
}
