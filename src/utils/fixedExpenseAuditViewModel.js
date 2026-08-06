function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function toPercent(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.min(100, Math.round(amount)));
}

function toMonthLabel(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "Échéance";
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(safeDate);
}

function toLongDateLabel(date) {
  const safeDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(safeDate.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(safeDate);
}

export function countOccurrenceTransactionDuplicates(occurrences = []) {
  const transactionIds = (occurrences || [])
    .flatMap((occurrence) => (occurrence?.transactions || []).map((entry) => String(entry?.transaction?.id || "").trim()))
    .filter(Boolean);
  return transactionIds.length - new Set(transactionIds).size;
}

export function buildFixedExpensesHealthMetrics({ fixedExpenses = [], ledger = null } = {}) {
  const occurrences = Array.isArray(ledger?.occurrences) ? ledger.occurrences : [];
  const reconciledCount = occurrences.filter((occurrence) => occurrence?.state === "transaction").length;
  const forecastCount = occurrences.filter((occurrence) => occurrence?.state === "forecast").length;
  const anomalyCount = occurrences.filter((occurrence) => occurrence?.state === "anomaly").length;
  const duplicateAccountingCount = countOccurrenceTransactionDuplicates(occurrences);
  const reliabilityIndex = occurrences.length > 0
    ? toPercent((reconciledCount / occurrences.length) * 100)
    : 100;

  return {
    fixedExpenseCount: (fixedExpenses || []).length,
    occurrenceCount: occurrences.length,
    reconciledCount,
    forecastCount,
    anomalyCount,
    duplicateAccountingCount,
    reliabilityIndex,
  };
}

export function buildFixedExpenseSynchronizationMetrics(summary = null) {
  const occurrences = Array.isArray(summary?.occurrences) ? summary.occurrences : [];
  const duplicateAccountingCount = countOccurrenceTransactionDuplicates(occurrences);
  const cumulativeDelta = occurrences.reduce((sum, occurrence) => sum + toAmount(occurrence?.amountDelta), 0);

  return {
    occurrenceCount: Number(summary?.occurrenceCount || 0),
    transactionCount: Number(summary?.transactionCount || 0),
    forecastCount: Number(summary?.forecastCount || 0),
    anomalyCount: Number(summary?.anomalyCount || 0),
    duplicateAccountingCount,
    cumulativeDelta,
  };
}

export function buildFixedExpenseGuaranteeLines(summary = null) {
  const metrics = buildFixedExpenseSynchronizationMetrics(summary);
  return [
    `Une seule valeur comptable utilisée${metrics.duplicateAccountingCount > 0 ? " : non" : ""}`,
    metrics.duplicateAccountingCount > 0 ? `${metrics.duplicateAccountingCount} doublon(s) comptable(s) détecté(s)` : "Aucun doublon détecté",
    metrics.forecastCount > 0 ? `${metrics.forecastCount} prévision(s) encore visible(s)` : "Prévisions automatiquement remplacées",
  ];
}

export function buildFixedExpenseAuditTimeline(summary = null) {
  const occurrences = Array.isArray(summary?.occurrences) ? summary.occurrences : [];

  return occurrences.map((occurrence) => {
    const transactionAmount = toAmount(occurrence?.accountingValue);
    const expectedAmount = toAmount(occurrence?.expectedAmount);
    const anomalyTransactions = Array.isArray(occurrence?.anomalyTransactions) ? occurrence.anomalyTransactions : [];
    const primaryTransactionLabel = occurrence?.primaryTransaction
      ? occurrence.primaryTransaction.description || occurrence.primaryTransaction.rawLabel || occurrence.primaryTransaction.label || occurrence.primaryTransaction.id
      : "Aucune transaction";

    const steps = [
      { key: "forecast", label: "Prévision", value: expectedAmount, tone: "info" },
    ];

    if (occurrence?.state === "forecast") {
      steps.push({ key: "missing", label: "Aucune transaction", tone: "muted" });
      steps.push({ key: "decision", label: "Prévision conservée", tone: "info" });
    } else if (occurrence?.state === "transaction") {
      steps.push({ key: "transaction", label: "Transaction trouvée", value: transactionAmount, detail: primaryTransactionLabel, tone: "success" });
      steps.push({ key: "decision", label: "Prévision supprimée", tone: "success" });
    } else {
      steps.push({ key: "transaction", label: "Deux transactions détectées", value: transactionAmount, detail: primaryTransactionLabel, tone: "warning" });
      steps.push({ key: "decision", label: "Anomalie", tone: "warning" });
      steps.push({ key: "ignored", label: "Deuxième transaction ignorée", detail: String(anomalyTransactions.length), tone: "warning" });
    }

    steps.push({ key: "accounting", label: "Valeur comptable retenue", value: transactionAmount || expectedAmount, tone: "emphasis" });
    if (toAmount(occurrence?.amountDelta) !== 0) {
      steps.push({ key: "delta", label: "Écart", value: toAmount(occurrence.amountDelta), tone: occurrence.amountDelta > 0 ? "warning" : "success" });
    }

    return {
      id: occurrence?.id || `${occurrence?.month || "occurrence"}-${primaryTransactionLabel}`,
      monthLabel: toMonthLabel(occurrence?.expectedDate),
      dateLabel: toLongDateLabel(occurrence?.expectedDate),
      state: occurrence?.state || "forecast",
      auditLabel: occurrence?.auditLabel || "Audit indisponible",
      steps,
    };
  });
}

function escapeCsvValue(value) {
  const normalized = String(value ?? "");
  if (!/[";\n\r]/.test(normalized)) return normalized;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function buildFixedExpenseAuditCsv(summary = null) {
  const occurrences = Array.isArray(summary?.occurrences) ? summary.occurrences : [];
  const rows = [
    ["echeance", "date_prevue", "etat", "prevision", "transaction", "decision", "valeur_comptable", "ecart", "audit"],
  ];

  occurrences.forEach((occurrence) => {
    const transactionLabel = (occurrence?.transactions || [])
      .map((entry) => entry?.transaction?.description || entry?.transaction?.rawLabel || entry?.transaction?.label || entry?.transaction?.id || "")
      .filter(Boolean)
      .join(" | ");
    const decision = occurrence?.state === "forecast"
      ? "Prévision conservée"
      : occurrence?.state === "anomaly"
        ? "Anomalie"
        : "Prévision supprimée";

    rows.push([
      toMonthLabel(occurrence?.expectedDate),
      toLongDateLabel(occurrence?.expectedDate),
      occurrence?.state || "forecast",
      toAmount(occurrence?.expectedAmount),
      transactionLabel,
      decision,
      toAmount(occurrence?.accountingValue),
      toAmount(occurrence?.amountDelta),
      occurrence?.auditLabel || "",
    ]);
  });

  return rows
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(";"))
    .join("\n");
}

export function downloadCsvReport(content, fileName = "horizon-audit-frais-fixes.csv") {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;

  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = fileName;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  return true;
}