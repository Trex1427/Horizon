import { normalizeImportedDate } from "./normalizeDate.js";
import { normalizeImportedAmount } from "./normalizeAmount.js";
import { normalizeImportedDescription, normalizeLabelForFingerprint } from "./normalizeDescription.js";
import { buildImportFingerprint } from "../utils/importFingerprint.js";

const TRANSFER_INTERNAL_HINTS = [
  "virement interne",
  "interne vers",
  "vers livret",
  "vers epargne",
  "depuis compte",
  "entre comptes",
];

const NON_INTERNAL_TRANSFER_HINTS = [
  "virement salaire",
  "virement client",
  "france travail",
  "caf",
  "remboursement",
];

function detectTransferCandidateFromLabel(rawLabel = "") {
  const label = String(rawLabel || "").trim().toLowerCase();

  if (!label.includes("virement")) {
    return {
      transferCandidate: false,
      transferConfidence: 0,
      transferReasons: [],
    };
  }

  if (NON_INTERNAL_TRANSFER_HINTS.some((hint) => label.includes(hint))) {
    return {
      transferCandidate: false,
      transferConfidence: 0,
      transferReasons: ["Libelle virement detecte mais contexte externe probable"],
    };
  }

  const matchedHints = TRANSFER_INTERNAL_HINTS.filter((hint) => label.includes(hint));
  if (matchedHints.length === 0) {
    return {
      transferCandidate: false,
      transferConfidence: 0,
      transferReasons: ["Mot virement detecte sans indice interne suffisant"],
    };
  }

  return {
    transferCandidate: true,
    transferConfidence: 0.72,
    transferReasons: matchedHints.map((hint) => `Libelle contenant ${hint}`),
  };
}

export function normalizeImportedTransaction(rawRow = {}, options = {}) {
  const operationDate = normalizeImportedDate(rawRow.operationDate);
  const valueDate = normalizeImportedDate(rawRow.valueDate);
  const rawLabel = normalizeImportedDescription(rawRow.rawLabel);
  const normalizedLabel = normalizeLabelForFingerprint(rawLabel);
  const amount = normalizeImportedAmount({
    amountText: rawRow.amount,
    debitText: rawRow.debit,
    creditText: rawRow.credit,
  });
  const warnings = [];
  const transferCandidateState = detectTransferCandidateFromLabel(rawLabel);

  if (!operationDate) {
    warnings.push("date_operation_invalide");
  }
  if (!rawLabel) {
    warnings.push("libelle_manquant");
  }
  if (amount === null || amount === 0) {
    warnings.push("montant_invalide");
  }

  const type = amount === null ? "depense" : (amount < 0 ? "depense" : "revenu");
  const fingerprint = buildImportFingerprint({
    accountId: options.accountId || "",
    operationDate: operationDate || "",
    amount: amount || 0,
    normalizedLabel,
    bankReference: rawRow.bankReference || "",
  });

  return {
    sourceFormat: options.sourceFormat || "csv",
    sourceBank: options.sourceBank || null,
    sourceFileName: options.sourceFileName || "",
    sourceRowIndex: Number(rawRow.sourceRowIndex || 0),
    operationDate,
    valueDate,
    rawLabel,
    normalizedLabel,
    merchant: rawLabel || null,
    amount,
    type,
    accountId: options.accountId || null,
    categoryId: null,
    categoryName: null,
    subcategoryId: null,
    subcategoryName: null,
    activityId: null,
    activityName: null,
    thirdPartyId: null,
    thirdPartyName: null,
    projectId: null,
    projectName: null,
    currency: rawRow.currency || "EUR",
    bankReference: rawRow.bankReference || null,
    fingerprint,
    importStatus: warnings.length === 0 ? "ready" : "review_required",
    duplicateOf: null,
    duplicateReason: "",
    duplicateStatus: "new_transaction",
    confidenceScore: warnings.length === 0 ? 1 : 0.5,
    warnings,
    transferCandidate: transferCandidateState.transferCandidate,
    transferConfidence: transferCandidateState.transferConfidence,
    transferReasons: transferCandidateState.transferReasons,
    transferConfirmed: false,
  };
}