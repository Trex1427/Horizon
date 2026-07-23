import { useEffect, useMemo } from "react";
import { Alert, Box, Chip, Stack, Typography } from "@mui/material";

function formatAmount(amount) {
  if (amount === null || amount === undefined) {
    return "N/A";
  }

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function buildSuggestionFieldLabels(row = {}) {
  return [
    ["Catégorie", row.categoryName || row.classificationSuggestion?.patch?.categoryId],
    ["Sous-catégorie", row.subcategoryName || row.classificationSuggestion?.patch?.subcategoryId],
    ["Tiers", row.thirdPartyName || row.classificationSuggestion?.patch?.thirdPartyId],
    ["Activite", row.activityName || row.classificationSuggestion?.patch?.activityId],
    ["Projet", row.projectName || row.classificationSuggestion?.patch?.projectId],
    ["Compte", row.accountName || row.classificationSuggestion?.patch?.accountId],
  ]
    .filter(([, value]) => Boolean(String(value || "").trim()))
    .map(([label, value]) => `${label}: ${value}`);
}

function getSuggestionOrigin(row = {}) {
  return row.classificationSuggestion?.reason
    || row.classificationSuggestion?.source
    || row.classificationSuggestion?.label
    || "Historique";
}

function getSuggestionBadgeLabel(row = {}) {
  const source = String(getSuggestionOrigin(row)).toLowerCase();
  if (source.includes("historique") || source.includes("history") || source.includes("known")) {
    return "Deja connue";
  }

  return "Suggestion trouvee";
}

export default function ImportPreviewStep({ preview = null, accountName = "", validationRows = [] }) {
  const visibleSuggestionRows = useMemo(
    () => validationRows.filter((row) => row.classificationSuggestionApplied && !row.classificationSuggestionIgnored),
    [validationRows]
  );
  const previewStats = useMemo(() => ({
    rows: preview?.transactions?.length || 0,
    importable: validationRows.filter((row) => row.userDecision === "import" && !row.validationError).length,
    duplicates: validationRows.filter((row) => row.duplicateStatus && row.duplicateStatus !== "new_transaction").length,
    review: validationRows.filter((row) => row.userDecision === "review" || row.validationError || !row.categoryId).length,
  }), [preview?.transactions?.length, validationRows]);

  useEffect(() => {
    if (!preview || typeof console === "undefined") {
      return;
    }

    const displayedCount = Array.isArray(preview.transactions) ? preview.transactions.length : 0;
    const diagnostic = {
      stage: "preview-render",
      transactionsReceived: preview.transactions?.length || 0,
      transactionsDisplayed: displayedCount,
      statementPeriod: preview.statementPeriod || null,
      statementSummary: preview.statementSummary || null,
      suggestionsDisplayed: visibleSuggestionRows.length,
      suggestionRows: visibleSuggestionRows.map((row) => ({
        sourceRowIndex: row.sourceRowIndex,
        rawLabel: row.rawLabel || "",
        categoryName: row.categoryName || "",
        thirdPartyName: row.thirdPartyName || "",
        score: row.classificationSuggestion?.score || 0,
        badgeRendered: true,
      })),
    };
    console.info("[bank-import:workflow-diagnostic]", diagnostic);
    if (typeof window !== "undefined") {
      window.__horizonBankImportDiagnostics = window.__horizonBankImportDiagnostics || [];
      window.__horizonBankImportDiagnostics.push(diagnostic);
    }
  }, [preview, validationRows, visibleSuggestionRows]);

  if (!preview) {
    return (
      <Alert severity="info" sx={{ borderRadius: 2 }}>
        Aucune operation a verifier pour le moment.
      </Alert>
    );
  }

  return (
    <Box sx={{ display: "grid", gap: 1.25, maxHeight: { xs: "calc(100dvh - 300px)", sm: 540 }, overflow: "auto", pr: 0.5 }}>
      <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" } }}>
        {[
          ["Operations", previewStats.rows],
          ["Peuvent etre importees", previewStats.importable],
          ["Doublons", previewStats.duplicates],
          ["A verifier", previewStats.review],
        ].map(([label, value]) => (
          <Box key={label} sx={{ border: "1px solid rgba(20, 41, 43, 0.1)", borderRadius: 2, p: 1, bgcolor: "rgba(246, 248, 244, 0.72)" }}>
            <Typography variant="caption" sx={{ color: "#61777b", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
              {label}
            </Typography>
            <Typography sx={{ fontWeight: 900, color: "#172a2f", lineHeight: 1.1 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Alert severity={visibleSuggestionRows.length > 0 ? "success" : "warning"} data-import-preview-suggestion-summary="true" sx={{ borderRadius: 2 }}>
        {visibleSuggestionRows.length > 0
          ? `${visibleSuggestionRows.length} suggestion(s) trouvee(s) dans ces operations.`
          : "Aucune suggestion automatique visible dans ces operations."}
      </Alert>

      {(preview.statementPeriod || preview.statementSummary) && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          {preview.statementPeriod?.startDate && preview.statementPeriod?.endDate
            ? `Période : ${preview.statementPeriod.startDate} au ${preview.statementPeriod.endDate}. `
            : ""}
          {preview.statementSummary?.totalOutgoing !== null && preview.statementSummary?.totalOutgoing !== undefined
            ? `Sorties: ${formatAmount(preview.statementSummary.totalOutgoing)}. `
            : ""}
          {preview.statementSummary?.totalIncoming !== null && preview.statementSummary?.totalIncoming !== undefined
            ? `Entrees: ${formatAmount(preview.statementSummary.totalIncoming)}. `
            : ""}
          {preview.statementSummary?.closingBalance !== null && preview.statementSummary?.closingBalance !== undefined
            ? `Solde: ${formatAmount(preview.statementSummary.closingBalance)}.`
            : ""}
        </Alert>
      )}

      <Stack spacing={0.85}>
        {preview.transactions.map((transaction) => {
          const validationRow = validationRows.find((row) => row.sourceRowIndex === transaction.sourceRowIndex) || {};
          const suggestionFields = buildSuggestionFieldLabels(validationRow);
          const hasSuggestion = validationRow.classificationSuggestionApplied && !validationRow.classificationSuggestionIgnored;
          const score = Math.round(Number(validationRow.classificationSuggestion?.score || validationRow.confidenceScore || 0));
          const amountColor = transaction.type === "revenu" ? "#147d64" : transaction.type === "depense" ? "#c24135" : "#0f5f8f";

          return (
            <Box
              data-import-preview-row="true"
              key={`${transaction.fingerprint}-${transaction.sourceRowIndex}`}
              sx={{
                display: "grid",
                gap: 0.6,
                border: "1px solid rgba(20, 41, 43, 0.1)",
                borderLeft: "4px solid",
                borderLeftColor: amountColor,
                borderRadius: 2,
                p: { xs: 1, sm: 1.15 },
                bgcolor: "rgba(255,255,255,0.96)",
                boxShadow: "0 6px 18px rgba(23, 42, 47, 0.07)",
              }}
            >
              <Stack direction="row" spacing={0.75} alignItems="flex-start" justifyContent="space-between">
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900, color: "#172a2f" }} noWrap>
                    {transaction.rawLabel || "Libelle a verifier"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {transaction.operationDate || "Date a verifier"} - {transaction.type || "type"} - {accountName || "Compte a verifier"}
                  </Typography>
                </Box>
                <Typography sx={{ color: amountColor, fontWeight: 900, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {formatAmount(transaction.amount)}
                </Typography>
              </Stack>

              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5 }}>
                <Chip size="small" label={`Catégorie: ${validationRow.categoryName || "A verifier"}`} variant="outlined" />
                <Chip size="small" label={`Statut: ${transaction.importStatus}`} variant="outlined" />
                {transaction.duplicateStatus && <Chip size="small" label={`Doublon: ${transaction.duplicateStatus}`} color="warning" variant="outlined" />}
                {hasSuggestion && (
                  <Chip
                    size="small"
                    color="success"
                    label={`${getSuggestionBadgeLabel(validationRow)} ${score ? `${score}%` : ""}`.trim()}
                    data-import-suggestion-badge="true"
                  />
                )}
              </Stack>

              {hasSuggestion && (
                <Alert severity="success" sx={{ py: 0.45, borderRadius: 2 }} data-import-preview-suggestion-alert="true">
                  {getSuggestionBadgeLabel(validationRow)} - origine: {getSuggestionOrigin(validationRow)}
                  {suggestionFields.length ? ` - ${suggestionFields.join(" - ")}` : ""}
                </Alert>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
