function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function toComparableDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getDayDistance(left, right) {
  const leftDate = toComparableDate(left);
  const rightDate = toComparableDate(right);
  if (!leftDate || !rightDate) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.abs(leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000);
}

function areLabelsSimilar(left, right) {
  const normalizedLeft = normalizeLabel(left);
  const normalizedRight = normalizeLabel(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft);
}

function buildExistingTransactionFingerprint(transaction = {}) {
  return String(transaction?.importFingerprint || "").trim();
}

function buildExistingTransactionLabel(transaction = {}) {
  return transaction?.description || transaction?.categoryName || transaction?.categorie || "";
}

function buildExistingTransactionAmount(transaction = {}) {
  const amount = Number(transaction?.montant || 0);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return transaction?.type === "depense" ? -Math.abs(amount) : Math.abs(amount);
}

export function detectImportedDuplicates(transactions = [], existingTransactions = []) {
  const imported = Array.isArray(transactions) ? transactions : [];
  const existing = Array.isArray(existingTransactions) ? existingTransactions : [];

  return imported.map((transaction, transactionIndex) => {
    const strictInternalMatch = imported.find((candidate, candidateIndex) => {
      if (candidateIndex === transactionIndex) {
        return false;
      }

      const sameReference = transaction.bankReference && candidate.bankReference && transaction.bankReference === candidate.bankReference;
      const sameFingerprint = transaction.fingerprint && candidate.fingerprint && transaction.fingerprint === candidate.fingerprint;
      return sameReference || sameFingerprint;
    });

    if (strictInternalMatch) {
      return {
        ...transaction,
        duplicateStatus: "exact_duplicate",
        duplicateReason: transaction.bankReference && strictInternalMatch.bankReference === transaction.bankReference
          ? "reference_identique"
          : "fingerprint_identique",
        duplicateOf: strictInternalMatch.fingerprint || strictInternalMatch.bankReference || null,
      };
    }

    const exactExistingMatch = existing.find((candidate) => {
      const candidateReference = String(candidate?.bankReference || "").trim();
      const sameReference = transaction.bankReference && candidateReference && candidateReference === transaction.bankReference;
      const sameFingerprint = transaction.fingerprint && buildExistingTransactionFingerprint(candidate) === transaction.fingerprint;
      return sameReference || sameFingerprint;
    });

    if (exactExistingMatch) {
      return {
        ...transaction,
        duplicateStatus: "exact_duplicate",
        duplicateReason: transaction.bankReference && exactExistingMatch.bankReference === transaction.bankReference
          ? "reference_existante"
          : "fingerprint_existant",
        duplicateOf: exactExistingMatch.id || exactExistingMatch.importFingerprint || null,
      };
    }

    const probableInternalMatch = imported.find((candidate, candidateIndex) => {
      if (candidateIndex === transactionIndex) {
        return false;
      }

      return candidate.accountId === transaction.accountId
        && Number(candidate.amount) === Number(transaction.amount)
        && getDayDistance(candidate.operationDate, transaction.operationDate) <= 2
        && areLabelsSimilar(candidate.normalizedLabel || candidate.rawLabel, transaction.normalizedLabel || transaction.rawLabel);
    });

    if (probableInternalMatch) {
      return {
        ...transaction,
        duplicateStatus: "probable_duplicate",
        duplicateReason: "doublon_probable_dans_fichier",
        duplicateOf: probableInternalMatch.fingerprint || null,
      };
    }

    const probableExistingMatch = existing.find((candidate) => {
      return String(candidate?.accountId || "") === String(transaction.accountId || "")
        && Number(buildExistingTransactionAmount(candidate)) === Number(transaction.amount)
        && getDayDistance(candidate?.date, transaction.operationDate) <= 2
        && areLabelsSimilar(buildExistingTransactionLabel(candidate), transaction.normalizedLabel || transaction.rawLabel);
    });

    if (probableExistingMatch) {
      return {
        ...transaction,
        duplicateStatus: "probable_duplicate",
        duplicateReason: "doublon_probable_existant",
        duplicateOf: probableExistingMatch.id || null,
      };
    }

    return {
      ...transaction,
      duplicateStatus: "new_transaction",
      duplicateReason: "",
      duplicateOf: null,
    };
  });
}