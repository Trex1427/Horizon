export function normalizeImportedDescription(value) {
  const cleaned = String(value || "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  return cleaned;
}

export function normalizeLabelForFingerprint(value) {
  return normalizeImportedDescription(value).toUpperCase();
}