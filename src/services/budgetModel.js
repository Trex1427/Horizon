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

const BUDGET_PERIODICITY_VALUES = new Set(["monthly", "quarterly", "semiAnnual", "annual", "custom"]);

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addMonths(date, monthCount) {
  const safeDate = startOfDay(date);
  const anchor = new Date(safeDate.getFullYear(), safeDate.getMonth() + monthCount, 1);
  const day = safeDate.getDate();
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  anchor.setDate(Math.min(day, monthEnd));
  return anchor;
}

function addDays(date, dayCount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dayCount, 0, 0, 0, 0);
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

export function normalizeBudgetPeriodicity(value, periodType = "") {
  const normalized = normalizeEnvelopeValue(value);
  if (BUDGET_PERIODICITY_VALUES.has(normalized)) {
    return normalized;
  }

  if (!normalized) {
    return "";
  }

  const legacy = normalizeEnvelopeValue(periodType).toLowerCase();
  if (["mensuel", "monthly"].includes(legacy)) return "monthly";
  if (["trimestriel", "quarterly"].includes(legacy)) return "quarterly";
  if (["semestriel", "semiannual", "semi-annual"].includes(legacy)) return "semiAnnual";
  if (["annuel", "annual", "yearly"].includes(legacy)) return "annual";
  if (["personnalise", "personnalisé", "custom"].includes(legacy)) return "custom";
  return "";
}

export function normalizeBudgetRollingPeriod(value) {
  return value === true || value === "true";
}

export function getBudgetPeriodicityLabel(periodicity = "annual") {
  const normalized = normalizeBudgetPeriodicity(periodicity) || "annual";
  if (normalized === "monthly") return "Mensuelle";
  if (normalized === "quarterly") return "Trimestrielle";
  if (normalized === "semiAnnual") return "Semestrielle";
  if (normalized === "custom") return "Personnalisée";
  return "Annuelle";
}

export function getBudgetTrackingLabel(rollingPeriod = false) {
  return normalizeBudgetRollingPeriod(rollingPeriod) ? "Période glissante" : "Période fixe";
}

export function resolveBudgetDateRange(budget = {}, referenceDate = new Date()) {
  const periodicity = normalizeBudgetPeriodicity(budget?.periodicity, budget?.periodType);
  const rollingPeriod = normalizeBudgetRollingPeriod(budget?.rollingPeriod);
  const reference = toDateValue(referenceDate) || new Date();
  const customStart = toDateValue(budget?.startDate);
  const customEnd = toDateValue(budget?.endDate);

  if (!periodicity) {
    return {
      startDate: customStart ? startOfDay(customStart) : null,
      endDate: customEnd ? endOfDay(customEnd) : null,
    };
  }

  if (periodicity === "custom") {
    if (!customStart) {
      return { startDate: null, endDate: null };
    }

    if (!rollingPeriod || !customEnd) {
      return {
        startDate: startOfDay(customStart),
        endDate: customEnd ? endOfDay(customEnd) : endOfDay(customStart),
      };
    }

    const durationMs = endOfDay(customEnd).getTime() - startOfDay(customStart).getTime();
    const endDate = endOfDay(reference);
    const startDate = new Date(endDate.getTime() - durationMs);
    return { startDate: startOfDay(startDate), endDate };
  }

  if (rollingPeriod) {
    const endDate = endOfDay(reference);
    if (periodicity === "monthly") {
      return { startDate: startOfDay(addDays(addMonths(reference, -1), 1)), endDate };
    }
    if (periodicity === "quarterly") {
      return { startDate: startOfDay(addDays(addMonths(reference, -3), 1)), endDate };
    }
    if (periodicity === "semiAnnual") {
      return { startDate: startOfDay(addDays(addMonths(reference, -6), 1)), endDate };
    }
    return { startDate: startOfDay(addDays(addMonths(reference, -12), 1)), endDate };
  }

  const year = reference.getFullYear();
  const month = reference.getMonth();
  if (periodicity === "monthly") {
    return {
      startDate: new Date(year, month, 1, 0, 0, 0, 0),
      endDate: new Date(year, month + 1, 0, 23, 59, 59, 999),
    };
  }
  if (periodicity === "quarterly") {
    const quarterStartMonth = Math.floor(month / 3) * 3;
    return {
      startDate: new Date(year, quarterStartMonth, 1, 0, 0, 0, 0),
      endDate: new Date(year, quarterStartMonth + 3, 0, 23, 59, 59, 999),
    };
  }
  if (periodicity === "semiAnnual") {
    const semesterStartMonth = month < 6 ? 0 : 6;
    return {
      startDate: new Date(year, semesterStartMonth, 1, 0, 0, 0, 0),
      endDate: new Date(year, semesterStartMonth + 6, 0, 23, 59, 59, 999),
    };
  }

  return {
    startDate: new Date(year, 0, 1, 0, 0, 0, 0),
    endDate: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function toLegacyPeriodType(periodicity) {
  if (periodicity === "monthly") return "mensuel";
  if (periodicity === "quarterly") return "trimestriel";
  if (periodicity === "semiAnnual") return "semestriel";
  if (periodicity === "custom") return "personnalise";
  return "annuel";
}

export function buildBudgetWritePayload(safePayload = {}) {
  const periodicity = normalizeBudgetPeriodicity(safePayload.periodicity, safePayload.periodType) || "annual";
  const rollingPeriod = normalizeBudgetRollingPeriod(safePayload.rollingPeriod);
  const startDate = normalizeDateString(safePayload.startDate);
  const endDate = normalizeDateString(safePayload.endDate);

  return {
    name: safePayload.name?.trim() || "",
    categoryId: normalizeEnvelopeValue(safePayload.categoryId),
    categoryName: safePayload.categoryName?.trim() || "",
    subcategoryId: normalizeEnvelopeValue(safePayload.subcategoryId) || null,
    subcategoryName: safePayload.subcategoryId ? (safePayload.subcategoryName?.trim() || null) : null,
    accountId: normalizeEnvelopeValue(safePayload.accountId) || null,
    amount: Number(safePayload.amount || 0),
    periodicity,
    rollingPeriod,
    startDate: periodicity === "custom" ? (startDate || null) : (startDate || normalizeDateString(new Date())),
    endDate: periodicity === "custom" ? (endDate || null) : null,
    typeBudget: safePayload.typeBudget || "depense",
    periodType: toLegacyPeriodType(periodicity),
  };
}

export function getBudgetPeriodIdentity(budget = {}) {
  const periodicity = normalizeBudgetPeriodicity(budget?.periodicity, budget?.periodType);
  const rollingPeriod = normalizeBudgetRollingPeriod(budget?.rollingPeriod) ? "rolling" : "fixed";
  if (!periodicity) {
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

  if (periodicity === "custom") {
    return [periodicity, rollingPeriod, normalizeDateString(budget?.startDate), normalizeDateString(budget?.endDate)].join("|");
  }

  return [periodicity, rollingPeriod].join("|");
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
