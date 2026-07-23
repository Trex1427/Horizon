const IDENTITY_FIELDS = [
  "accountId",
  "categoryId",
  "subcategoryId",
  "thirdPartyId",
  "activityId",
  "projectId",
];

export function normalizeFixedExpenseName(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr-FR");
}

function normalizeIdentityValue(value) {
  return String(value || "").trim();
}

function normalizeFrequency(value) {
  const normalized = normalizeIdentityValue(value).toLowerCase();
  if (normalized === "mensuel") return "monthly";
  if (normalized === "annuel") return "annual";
  return normalized || "monthly";
}

export function buildFixedExpenseIdentity(fixedExpense = {}) {
  return [
    normalizeFixedExpenseName(fixedExpense.name),
    normalizeFrequency(fixedExpense.frequency),
    ...IDENTITY_FIELDS.map((field) => normalizeIdentityValue(fixedExpense[field])),
  ].join("|");
}

export function areFixedExpensesCompatible(left = {}, right = {}) {
  const leftName = normalizeFixedExpenseName(left.name);
  return Boolean(leftName) && leftName === normalizeFixedExpenseName(right.name)
    && buildFixedExpenseIdentity(left) === buildFixedExpenseIdentity(right);
}

export function findCompatibleFixedExpenses(candidate = {}, fixedExpenses = []) {
  return (Array.isArray(fixedExpenses) ? fixedExpenses : [])
    .filter((fixedExpense) => fixedExpense?.isActive !== false)
    .filter((fixedExpense) => areFixedExpensesCompatible(candidate, fixedExpense));
}

export function buildFixedExpenseDocumentId(fixedExpense = {}) {
  const identity = buildFixedExpenseIdentity(fixedExpense);
  let first = 2166136261;
  let second = 5381;

  for (let index = 0; index < identity.length; index += 1) {
    const code = identity.charCodeAt(index);
    first = Math.imul(first ^ code, 16777619);
    second = Math.imul(second, 33) ^ code;
  }

  return `fixed-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}
