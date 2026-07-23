import { normalizeTransactionType } from "./transactionTypeUtils.js";

export const SIMILAR_CLASSIFICATION_FIELDS = [
  "categoryId",
  "subcategoryId",
  "thirdPartyId",
  "activityId",
  "projectId",
  "accountId",
];

/**
 * Canonical form used only for exact transaction-title matching.
 * Unicode is composed (NFC), surrounding whitespace is removed, repeated
 * whitespace is collapsed, and casing is ignored. Accents and punctuation
 * remain significant; this intentionally performs no fuzzy matching.
 */
export function normalizeTransactionTitle(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr-FR");
}

function isArchived(transaction = {}) {
  return transaction.isArchived === true || transaction.archived === true || Boolean(transaction.archivedAt);
}

export function findSimilarTransactions(transactions = [], source = {}) {
  const sourceTitle = normalizeTransactionTitle(source.description);
  const sourceType = normalizeTransactionType(source.type);

  if (!sourceTitle || !sourceType) {
    return [];
  }

  return (transactions || []).filter((candidate) => (
    candidate
    && candidate.id
    && candidate.id !== source.id
    && candidate.isDeleted !== true
    && !isArchived(candidate)
    && normalizeTransactionType(candidate.type) === sourceType
    && normalizeTransactionTitle(candidate.description) === sourceTitle
  ));
}

export function findClassificationSuggestionCandidates(transactions = [], source = {}) {
  const sourceTitle = normalizeTransactionTitle(source.description || source.rawLabel || source.normalizedLabel);
  const sourceType = normalizeTransactionType(source.type);
  const sourceAccountId = String(source.accountId || "").trim();

  if (!sourceTitle || !sourceType || !sourceAccountId) {
    return [];
  }

  return (transactions || []).filter((candidate) => (
    candidate
    && candidate.id !== source.id
    && candidate.isDeleted !== true
    && !isArchived(candidate)
    && normalizeTransactionType(candidate.type) === sourceType
    && String(candidate.accountId || "").trim() === sourceAccountId
    && normalizeTransactionTitle(candidate.description || candidate.rawLabel || candidate.normalizedLabel) === sourceTitle
  ));
}

function getWinner(counts) {
  const entries = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const [winner, runnerUp] = entries;

  if (!winner || (runnerUp && runnerUp[1] === winner[1])) {
    return null;
  }

  return { value: winner[0], count: winner[1] };
}

export function buildTransactionClassificationSuggestion(transactions = [], source = {}) {
  const candidates = findClassificationSuggestionCandidates(transactions, source);

  if (candidates.length === 0) {
    return null;
  }

  let totalVotes = 0;
  let winningVotes = 0;
  const patch = {};
  const fieldScores = {};

  SIMILAR_CLASSIFICATION_FIELDS.forEach((field) => {
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
      return;
    }

    patch[field] = winner.value;
    winningVotes += winner.count;
    fieldScores[field] = fieldTotal > 0 ? winner.count / fieldTotal : 0;
  });

  if (Object.keys(patch).length === 0 || totalVotes === 0) {
    return null;
  }

  const consistency = winningVotes / totalVotes;
  const sampleBoost = candidates.length === 1 ? 0.95 : 1;
  const score = Math.round(consistency * sampleBoost * 100);

  if (score < 80) {
    return null;
  }

  return {
    score,
    label: score >= 95 ? "Suggestion très fiable" : "Suggestion",
    patch,
    candidateCount: candidates.length,
    fieldScores,
  };
}

export function buildChangedClassificationPatch(initialForm = {}, savedForm = {}) {
  return SIMILAR_CLASSIFICATION_FIELDS.reduce((patch, field) => {
    const initialValue = String(initialForm[field] || "").trim();
    const savedValue = String(savedForm[field] || "").trim();

    if (savedValue && savedValue !== initialValue) {
      patch[field] = savedValue;
    }

    return patch;
  }, {});
}
