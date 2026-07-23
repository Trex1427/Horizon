export function parseLocalizedNumber(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  const normalized = raw
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/€/g, "")
    .replace(/\b(?:eur|euros?|euro)\b/gi, "")
    .replace(/\bdebit\b/gi, "-")
    .replace(/\bcredit\b/gi, "")
    .trim();

  if (!normalized) {
    return null;
  }

  const sign = normalized.includes("-") ? -1 : 1;
  let digits = normalized.replace(/[^0-9,.-]/g, "");
  digits = digits.replace(/-/g, "");

  const lastComma = digits.lastIndexOf(",");
  const lastDot = digits.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : (lastDot > lastComma ? "." : "");

  if (decimalSeparator) {
    const separatorIndex = digits.lastIndexOf(decimalSeparator);
    const integerPart = digits.slice(0, separatorIndex).replace(/[,.]/g, "");
    const decimalPart = digits.slice(separatorIndex + 1);
    const composed = `${integerPart}.${decimalPart}`;
    const amount = Number(composed);
    return Number.isFinite(amount) ? amount * sign : null;
  }

  const amount = Number(digits.replace(/[,.]/g, ""));
  return Number.isFinite(amount) ? amount * sign : null;
}

export function normalizeImportedAmount({ amountText = "", debitText = "", creditText = "" } = {}) {
  const directAmount = parseLocalizedNumber(amountText);
  if (directAmount !== null && directAmount !== 0) {
    return directAmount;
  }

  const debitAmount = parseLocalizedNumber(debitText);
  if (debitAmount !== null && debitAmount !== 0) {
    return -Math.abs(debitAmount);
  }

  const creditAmount = parseLocalizedNumber(creditText);
  if (creditAmount !== null && creditAmount !== 0) {
    return Math.abs(creditAmount);
  }

  return null;
}