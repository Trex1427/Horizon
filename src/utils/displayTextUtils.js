function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const TECHNICAL_CATEGORY_VALUES = new Set([
  "expense",
  "income",
  "fixed",
  "variable",
  "default",
  "slug",
  "id",
  "restaurant",
  "home",
  "directions_car",
  "medical_services",
  "sports_esports",
  "subscriptions",
  "receipt_long",
  "account_balance_wallet",
  "payments",
  "work",
  "category",
]);

function isLikelyIdentifier(value) {
  const normalized = String(value || "").trim();
  if (!normalized || /\s/.test(normalized)) {
    return false;
  }

  if (/^(cat|category|id)[-_]/i.test(normalized)) {
    return true;
  }

  const hasLetter = /[a-zA-Z]/.test(normalized);
  const hasDigit = /\d/.test(normalized);
  return normalized.length >= 10 && hasLetter && hasDigit;
}

export function isTechnicalCategoryDisplayValue(value) {
  const normalized = normalizeText(value);
  if (!normalized) {
    return true;
  }

  if (TECHNICAL_CATEGORY_VALUES.has(normalized)) {
    return true;
  }

  if (isLikelyIdentifier(value)) {
    return true;
  }

  return false;
}

export function getSafeCategoryLabel(value, fallback = "Sans categorie") {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return fallback;
  }

  return isTechnicalCategoryDisplayValue(cleaned) ? fallback : cleaned;
}

export function getSafeIconLabel(value) {
  const cleaned = String(value || "").trim();
  if (!cleaned) {
    return "Icône";
  }

  if (/\p{Extended_Pictographic}/u.test(cleaned)) {
    return cleaned;
  }

  if (cleaned.length <= 2 && /[^a-zA-Z0-9]/.test(cleaned)) {
    return cleaned;
  }

  return "Icône";
}

export function normalizeLooseFrenchText(value) {
  return normalizeText(value)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
