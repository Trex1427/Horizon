import { normalizeImportedDescription } from "../normalizers/normalizeDescription.js";

const CLASSIFICATION_FIELDS = [
  "categoryId", "categoryName",
  "subcategoryId", "subcategoryName",
  "thirdPartyId", "thirdPartyName",
  "activityId", "activityName",
  "projectId", "projectName",
];

export function normalizeComparableImportLabel(value) {
  return normalizeImportedDescription(value)
    .toUpperCase()
    .replace(/\bX\d{4}\b/g, " ")
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/^(?:PAIEMENT PAR CARTE|PAIEMENT CARTE|CARTE|AVOIR)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildClassificationPatch(row = {}) {
  return Object.fromEntries(CLASSIFICATION_FIELDS.map((field) => [field, row[field] ?? null]));
}

function getOperationYear(value) {
  const match = String(value || "").match(/(?:^|\D)((?:19|20)\d{2})(?:\D|$)/);
  return match?.[1] || "";
}

export function getSimilarImportRowMatchDetails(sourceRow = {}, row = {}) {
  return {
    sameMerchant: normalizeComparableImportLabel(row.merchant || row.rawLabel || row.normalizedLabel)
      === normalizeComparableImportLabel(sourceRow.merchant || sourceRow.rawLabel || sourceRow.normalizedLabel),
    sameAmount: Math.round(Number(row.amount || 0) * 100) === Math.round(Number(sourceRow.amount || 0) * 100),
    sameAccount: Boolean(sourceRow.accountId) && row.accountId === sourceRow.accountId,
    sameYear: Boolean(getOperationYear(sourceRow.operationDate))
      && getOperationYear(row.operationDate) === getOperationYear(sourceRow.operationDate),
  };
}

export function findSimilarUnvalidatedImportRows(rows = [], sourceRow = {}, options = {}) {
  const sourceMerchant = normalizeComparableImportLabel(sourceRow.merchant || sourceRow.rawLabel || sourceRow.normalizedLabel);
  const sourceAmount = Math.round(Number(sourceRow.amount || 0) * 100);
  const ignoreAmountDifferences = options.ignoreAmountDifferences === true;
  const sameAccountOnly = options.sameAccountOnly === true;
  const sameYearOnly = options.sameYearOnly === true;
  if (!sourceMerchant || !Number.isFinite(sourceAmount)) return [];

  return rows.filter((row) => {
    const match = getSimilarImportRowMatchDetails(sourceRow, row);
    return row.sourceRowIndex !== sourceRow.sourceRowIndex
      && row.classificationValidated !== true
      && match.sameMerchant
      && (ignoreAmountDifferences || match.sameAmount)
      && (!sameAccountOnly || match.sameAccount)
      && (!sameYearOnly || match.sameYear);
  });
}

export function describeSimilarImportRowMatch(sourceRow = {}, row = {}) {
  const match = getSimilarImportRowMatchDetails(sourceRow, row);
  const reasons = [match.sameAmount ? "même montant" : "montant différent"];
  if (match.sameAccount) reasons.push("même compte");
  if (match.sameYear) reasons.push("même année");
  return `Même commerçant + ${reasons.join(" + ")}`;
}

export function findIdenticalUnvalidatedImportRows(rows = [], sourceRow = {}) {
  return findSimilarUnvalidatedImportRows(rows, sourceRow, { ignoreAmountDifferences: false });
}

export function applyClassificationToImportRows(rows = [], sourceRow = {}, selectedSourceRowIndexes = []) {
  const selected = new Set([sourceRow.sourceRowIndex, ...selectedSourceRowIndexes]);
  const patch = buildClassificationPatch(sourceRow);
  return rows.map((row) => selected.has(row.sourceRowIndex)
    ? { ...row, ...patch, classificationValidated: true }
    : row);
}

export function findFirstUnvalidatedImportRow(rows = []) {
  return rows.find((row) => row.classificationValidated !== true && row.userDecision !== "skip") || null;
}