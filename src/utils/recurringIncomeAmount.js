function toValidAmount(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === "function") return value.toDate();

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Reads recurring-income amounts across current and legacy document shapes.
 * A finite zero is intentional and must not fall through to another field.
 */
export function getRecurringIncomeBaseAmount(income = {}) {
  const candidates = [income.currentAmount, income.amount, income.initialAmount, income.baseAmount];

  for (const candidate of candidates) {
    const amount = toValidAmount(candidate);
    if (amount !== null) return amount;
  }

  return 0;
}

/** Reads the contractual initial amount used by the form and secondary label. */
export function getRecurringIncomeInitialAmount(income = {}) {
  const candidates = [income.initialAmount, income.baseAmount, income.amount, income.currentAmount];

  for (const candidate of candidates) {
    const amount = toValidAmount(candidate);
    if (amount !== null) return amount;
  }

  return 0;
}

/** Resolves the configured amount at a date, independently of occurrence eligibility. */
export function getRecurringIncomeApplicableAmount(income = {}, targetDate = new Date()) {
  const baseAmount = getRecurringIncomeBaseAmount(income);
  const target = toDateValue(targetDate);
  const variations = Array.isArray(income.variations) ? income.variations : [];

  if (!target || variations.length === 0) {
    return baseAmount;
  }

  const applicableVariation = variations
    .filter((variation) => {
      const effectiveDate = toDateValue(variation?.effectiveDate);
      return effectiveDate && effectiveDate <= target;
    })
    .sort((left, right) => {
      const leftDate = toDateValue(left?.effectiveDate);
      const rightDate = toDateValue(right?.effectiveDate);
      return (rightDate?.getTime?.() || 0) - (leftDate?.getTime?.() || 0);
    })[0];

  const variationAmount = toValidAmount(applicableVariation?.amount);
  return variationAmount === null ? baseAmount : variationAmount;
}
