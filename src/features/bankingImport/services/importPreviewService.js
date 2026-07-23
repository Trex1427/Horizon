import { analyzeCsvContent, parseCsvContent } from "../parsers/csvParser.js";
import { parsePdfContent } from "../parsers/pdfParser.js";
import { buildCsvStructureKey } from "../detectors/detectCsvMapping.js";
import { detectImportedDuplicates } from "../detectors/duplicateDetector.js";
import { suggestCategory } from "./categorySuggestionService.js";
import { normalizeTransactionTitle, SIMILAR_CLASSIFICATION_FIELDS } from "../../../utils/similarTransactionClassification.js";
import { normalizeTransactionType } from "../../../utils/transactionTypeUtils.js";

function toAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function hasCrossAccountOppositeAmountCandidate(transaction, existingTransactions = []) {
  const accountId = String(transaction?.accountId || "");
  const absoluteAmount = Math.abs(toAmount(transaction?.amount));

  if (!accountId || absoluteAmount <= 0) {
    return false;
  }

  return (existingTransactions || []).some((candidate) => {
    const candidateAccountId = String(candidate?.accountId || "");
    const candidateType = String(candidate?.type || "").toLowerCase();
    const normalizedCandidateType = ["revenu", "income", "recette"].includes(candidateType)
      ? "revenu"
      : ["depense", "dépense", "expense"].includes(candidateType)
        ? "depense"
        : "";
    const normalizedTransactionType = String(transaction?.type || "").toLowerCase();

    if (!candidateAccountId || candidateAccountId === accountId) {
      return false;
    }

    if (!normalizedCandidateType || normalizedCandidateType === normalizedTransactionType) {
      return false;
    }

    return Math.abs(Math.abs(toAmount(candidate?.montant ?? candidate?.amount)) - absoluteAmount) <= 0.01;
  });
}

export function normalizeBankImportClassificationTitle(value = "") {
  const withoutBankNoise = String(value || "")
    .normalize("NFC")
    .replace(/\b(?:paiement\s+par\s+carte|virement\s+en\s+votre\s+faveur|avoir\s+carte)\b/giu, " ")
    .replace(/\bX\d{3,}\b/giu, " ")
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/gu, " ")
    .replace(/\b\d{8,}\b/gu, " ")
    .replace(/\b[A-Z]*\d+[A-Z\d]*\b/giu, " ")
    .replace(/(^|\s)[A-Z](?=\s|$)/gu, "$1")
    .replace(/\b\d+[,.]\d{2}\s*(?:EUR|€)\b/giu, " ")
    .replace(/\b(?:EUR|€)\b/giu, " ")
    .replace(/\b(?:a|de)\s*:/giu, " ")
    .replace(/\bcarte\s*:\s*\*?\d+\b/giu, " ")
    .replace(/[*,;:_-]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  return normalizeTransactionTitle(withoutBankNoise);
}

function isArchived(transaction = {}) {
  return transaction.isArchived === true || transaction.archived === true || Boolean(transaction.archivedAt);
}

function getWinner(counts) {
  const entries = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const [winner, runnerUp] = entries;

  if (!winner || (runnerUp && runnerUp[1] === winner[1])) {
    return null;
  }

  return { value: winner[0], count: winner[1] };
}

export function buildBankImportClassificationSuggestion(existingTransactions = [], source = {}) {
  const sourceTitle = normalizeBankImportClassificationTitle(source.description || source.rawLabel || source.normalizedLabel);
  const sourceType = normalizeTransactionType(source.type);
  const sourceAccountId = String(source.accountId || "").trim();

  const emptyTrace = {
    normalizedDescription: sourceTitle,
    historicalCandidateCountBeforeAccount: 0,
    historicalCandidateCountAfterAccount: 0,
    historicalCandidateCount: 0,
    historicalCandidateIds: [],
    scores: {},
    proposedFields: {},
  };

  if (!sourceTitle || !sourceType || !sourceAccountId) {
    return {
      suggestion: null,
      trace: {
        ...emptyTrace,
        noSuggestionReason: !sourceAccountId ? "missing_account" : !sourceType ? "missing_type" : "missing_description",
      },
    };
  }

  const candidatesBeforeAccount = (existingTransactions || []).filter((candidate) => (
    candidate
    && candidate.id !== source.id
    && candidate.isDeleted !== true
    && !isArchived(candidate)
    && normalizeTransactionType(candidate.type) === sourceType
    && normalizeBankImportClassificationTitle(candidate.description || candidate.rawLabel || candidate.normalizedLabel) === sourceTitle
  ));
  const candidates = candidatesBeforeAccount.filter((candidate) => String(candidate.accountId || "").trim() === sourceAccountId);

  if (candidates.length === 0) {
    return {
      suggestion: null,
      trace: {
        ...emptyTrace,
        historicalCandidateCountBeforeAccount: candidatesBeforeAccount.length,
        historicalCandidateCountAfterAccount: 0,
        noSuggestionReason: candidatesBeforeAccount.length > 0 ? "history_on_other_account" : "no_matching_history",
      },
    };
  }

  let totalVotes = 0;
  let winningVotes = 0;
  const patch = {};
  const fieldScores = {};

  SIMILAR_CLASSIFICATION_FIELDS.filter((field) => field !== "accountId").forEach((field) => {
    const counts = new Map();

    candidates.forEach((candidate) => {
      const value = String(candidate[field] || "").trim();
      if (!value) {
        return;
      }

      counts.set(value, (counts.get(value) || 0) + 1);
    });

    const fieldTotal = [...counts.values()].reduce((sum, count) => sum + count, 0);
    totalVotes += fieldTotal;

    const winner = getWinner(counts);
    if (!winner) {
      if (fieldTotal > 0) {
        fieldScores[field] = 0;
      }
      return;
    }

    patch[field] = winner.value;
    winningVotes += winner.count;
    fieldScores[field] = fieldTotal > 0 ? winner.count / fieldTotal : 0;
  });

  const candidateIds = candidates.map((candidate) => candidate.id).filter(Boolean);

  if (Object.keys(patch).length === 0 || totalVotes === 0) {
    return {
      suggestion: null,
      trace: {
        normalizedDescription: sourceTitle,
        historicalCandidateCountBeforeAccount: candidatesBeforeAccount.length,
        historicalCandidateCountAfterAccount: candidates.length,
        historicalCandidateCount: candidates.length,
        historicalCandidateIds: candidateIds,
        scores: fieldScores,
        proposedFields: patch,
        noSuggestionReason: "no_winning_field",
      },
    };
  }

  const consistency = winningVotes / totalVotes;
  const sampleBoost = candidates.length === 1 ? 0.95 : 1;
  const score = Math.round(consistency * sampleBoost * 100);

  if (score < 80) {
    return {
      suggestion: null,
      trace: {
        normalizedDescription: sourceTitle,
        historicalCandidateCountBeforeAccount: candidatesBeforeAccount.length,
        historicalCandidateCountAfterAccount: candidates.length,
        historicalCandidateCount: candidates.length,
        historicalCandidateIds: candidateIds,
        scores: fieldScores,
        proposedFields: patch,
        noSuggestionReason: "score_below_80",
      },
    };
  }

  patch.accountId = sourceAccountId;
  fieldScores.accountId = 1;

  return {
    suggestion: {
      score,
      label: score >= 95 ? "Suggestion très fiable" : "Suggestion",
      patch,
      candidateCount: candidates.length,
      fieldScores,
    },
    trace: {
      normalizedDescription: sourceTitle,
      historicalCandidateCountBeforeAccount: candidatesBeforeAccount.length,
      historicalCandidateCountAfterAccount: candidates.length,
      historicalCandidateCount: candidates.length,
      historicalCandidateIds: candidateIds,
      scores: fieldScores,
      proposedFields: patch,
      noSuggestionReason: "",
    },
  };
}

function logImportSuggestionTrace(payload = {}) {
  if (typeof console === "undefined") {
    return;
  }

  console.info("[bank-import:suggestion-trace]", payload);
  if (typeof window !== "undefined") {
    window.__horizonBankImportSuggestionTrace = window.__horizonBankImportSuggestionTrace || [];
    window.__horizonBankImportSuggestionTrace.push(payload);
  }
}

const CSV_MAPPING_STORAGE_KEY = "horizon-banking-import-csv-mappings";

function getSafeLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function loadSavedCsvMapping(structureKey = "") {
  const storage = getSafeLocalStorage();
  if (!storage || !structureKey) {
    return null;
  }

  try {
    const parsed = JSON.parse(storage.getItem(CSV_MAPPING_STORAGE_KEY) || "{}");
    return parsed[structureKey] || null;
  } catch {
    return null;
  }
}

export function saveCsvMapping(structureKey = "", mapping = {}) {
  const storage = getSafeLocalStorage();
  if (!storage || !structureKey) {
    return;
  }

  try {
    const parsed = JSON.parse(storage.getItem(CSV_MAPPING_STORAGE_KEY) || "{}");
    parsed[structureKey] = mapping;
    storage.setItem(CSV_MAPPING_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // Intentionally silent: mapping persistence must never block preview.
  }
}

export function prepareCsvImportAnalysis({ content = "", fileName = "" } = {}) {
  const analysis = analyzeCsvContent(content);
  const structureKey = buildCsvStructureKey(analysis.headers, analysis.delimiter);
  const savedMapping = loadSavedCsvMapping(structureKey);

  return {
    ...analysis,
    fileName,
    structureKey,
    mapping: savedMapping || analysis.mapping,
    requiresMapping: savedMapping
      ? (!savedMapping.operationDate || !savedMapping.label || (!savedMapping.amount && !savedMapping.debit && !savedMapping.credit))
      : analysis.requiresMapping,
  };
}

export function buildCsvImportPreview({ content = "", fileName = "", accountId = "", mapping = {}, structureKey = "" } = {}) {
  const preview = parseCsvContent(content, {
    sourceFileName: fileName,
    accountId,
    mapping,
  });

  if (structureKey) {
    saveCsvMapping(structureKey, preview.mapping);
  }

  return {
    ...preview,
    transactions: detectImportedDuplicates(preview.transactions),
  };
}

export function buildImportValidationRows({ preview = null, existingTransactions = [], categories = [], subcategories = [], activities = [], thirdParties = [], projects = [], accounts = [] } = {}) {
  const sourcePreview = preview || { transactions: [] };
  const duplicatedTransactions = detectImportedDuplicates(sourcePreview.transactions, existingTransactions);
  const categoryMap = new Map(categories.map((item) => [item.id, item]));
  const subcategoryMap = new Map(subcategories.map((item) => [item.id, item]));
  const activityMap = new Map(activities.map((item) => [item.id, item]));
  const thirdPartyMap = new Map(thirdParties.map((item) => [item.id, item]));
  const projectMap = new Map(projects.map((item) => [item.id, item]));
  const accountMap = new Map(accounts.map((item) => [item.id, item]));

  return duplicatedTransactions.map((transaction) => {
    const suggestion = suggestCategory(transaction, { categories, existingTransactions });
    const classificationResult = buildBankImportClassificationSuggestion(existingTransactions, {
      id: transaction.id,
      description: transaction.rawLabel || transaction.normalizedLabel,
      type: transaction.type,
      accountId: transaction.accountId,
    });
    const classificationSuggestion = classificationResult.suggestion;
    const classificationPatch = classificationSuggestion?.patch || {};
    const suggestedCategoryId = classificationPatch.categoryId || suggestion.categoryId || transaction.categoryId || null;
    const suggestedCategory = categoryMap.get(suggestedCategoryId);
    const oppositeAmountMatch = hasCrossAccountOppositeAmountCandidate(transaction, existingTransactions);
    const transferReasons = Array.isArray(transaction.transferReasons) ? [...transaction.transferReasons] : [];
    const transferCandidateFromRow = Boolean(transaction.transferCandidate);
    const transferConfidenceFromRow = Number(transaction.transferConfidence || 0);

    if (oppositeAmountMatch) {
      transferReasons.push("Montant oppose trouve sur un autre compte");
    }

    const transferCandidate = transferCandidateFromRow || oppositeAmountMatch;
    const transferConfidence = transferCandidate
      ? Math.max(transferConfidenceFromRow, oppositeAmountMatch ? 0.82 : transferConfidenceFromRow)
      : 0;

    const validationError = transaction.amount === null || !transaction.operationDate || !transaction.rawLabel
      ? "Ligne incomplete a corriger"
      : "";

    const row = {
      ...transaction,
      categoryId: suggestedCategoryId,
      categoryName: suggestedCategory?.name || suggestion.categoryName || transaction.categoryName || null,
      subcategoryId: classificationPatch.subcategoryId || transaction.subcategoryId || null,
      subcategoryName: subcategoryMap.get(classificationPatch.subcategoryId)?.name || transaction.subcategoryName || null,
      activityId: classificationPatch.activityId || transaction.activityId || null,
      activityName: activityMap.get(classificationPatch.activityId)?.name || transaction.activityName || null,
      thirdPartyId: classificationPatch.thirdPartyId || transaction.thirdPartyId || null,
      thirdPartyName: thirdPartyMap.get(classificationPatch.thirdPartyId)?.name || transaction.thirdPartyName || null,
      projectId: classificationPatch.projectId || transaction.projectId || null,
      projectName: projectMap.get(classificationPatch.projectId)?.name || transaction.projectName || null,
      accountName: accountMap.get(classificationPatch.accountId || transaction.accountId)?.name || transaction.accountName || null,
      classificationSuggestion,
      classificationSuggestionApplied: Boolean(classificationSuggestion),
      classificationSuggestionIgnored: false,
      suggestedCategory: suggestion,
      transferCandidate,
      transferConfidence,
      transferReasons,
      transferConfirmed: false,
      transferSourceAccountId: transferCandidate && transaction.type === "depense" ? (transaction.accountId || "") : "",
      transferDestinationAccountId: transferCandidate && transaction.type === "revenu" ? (transaction.accountId || "") : "",
      userDecision: transaction.duplicateStatus === "exact_duplicate"
        ? "skip"
        : (validationError ? "review" : (transaction.duplicateStatus === "probable_duplicate" ? "review" : "import")),
      validationError,
    };

    logImportSuggestionTrace({
      sourceRowIndex: transaction.sourceRowIndex,
      rawDescription: transaction.rawLabel || "",
      normalizedDescription: classificationResult.trace.normalizedDescription,
      type: transaction.type || "",
      accountId: transaction.accountId || "",
      historicalCandidateCountBeforeAccount: classificationResult.trace.historicalCandidateCountBeforeAccount,
      historicalCandidateCountAfterAccount: classificationResult.trace.historicalCandidateCountAfterAccount,
      historicalCandidateCount: classificationResult.trace.historicalCandidateCount,
      historicalCandidateIds: classificationResult.trace.historicalCandidateIds,
      scores: classificationResult.trace.scores,
      proposedFields: classificationResult.trace.proposedFields,
      noSuggestionReason: classificationResult.trace.noSuggestionReason,
      validationRowStored: {
        categoryId: row.categoryId || null,
        categoryName: row.categoryName || null,
        subcategoryId: row.subcategoryId || null,
        subcategoryName: row.subcategoryName || null,
        thirdPartyId: row.thirdPartyId || null,
        thirdPartyName: row.thirdPartyName || null,
        activityId: row.activityId || null,
        activityName: row.activityName || null,
        projectId: row.projectId || null,
        projectName: row.projectName || null,
        classificationSuggestionApplied: row.classificationSuggestionApplied,
      },
      suggestionTransmittedToPreview: Boolean(classificationSuggestion),
      suggestionDisplayedInValidation: Boolean(classificationSuggestion),
    });

    return row;
  });
}

export function preparePdfImportAnalysis({ content = "", fileName = "" } = {}) {
  const preview = parsePdfContent(content, { sourceFileName: fileName });

  return {
    fileName,
    headers: preview.headers,
    mapping: {},
    requiresMapping: false,
    rowCount: preview.transactions.length,
    statementPeriod: preview.statementPeriod,
    statementSummary: preview.statementSummary,
  };
}

export function buildPdfImportPreview({ content = "", fileName = "", accountId = "" } = {}) {
  const preview = parsePdfContent(content, {
    sourceFileName: fileName,
    accountId,
  });

  return {
    ...preview,
    transactions: detectImportedDuplicates(preview.transactions),
  };
}
