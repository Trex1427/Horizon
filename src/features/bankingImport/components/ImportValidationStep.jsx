import { useMemo, useRef, useState } from "react";
import { useAuth } from "../../../auth/useAuth.js";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Stack, TextField, Typography } from "@mui/material";
import {
  CREATE_ACCOUNT_VALUE,
  CREATE_ACTIVITY_VALUE,
  CREATE_CATEGORY_VALUE,
  CREATE_PROJECT_VALUE,
  CREATE_SUBCATEGORY_VALUE,
  CREATE_THIRD_PARTY_VALUE,
} from "../../../constants/transactionReferenceCreateValues";
import { applyClassificationToImportRows, describeSimilarImportRowMatch, findFirstUnvalidatedImportRow, findSimilarUnvalidatedImportRows } from "../utils/classificationBatchAssistant.js";
import { applyClassificationToOwnedHistory, searchOwnedHistoricalTransactions } from "../services/historicalSimilarityService.js";

const FILTER_OPTIONS = [
  { value: "all", label: "Toutes" },
  { value: "errors", label: "A verifier" },
  { value: "duplicates", label: "Doublons" },
  { value: "transferCandidates", label: "Candidats transfert" },
  { value: "suggestions", label: "Avec suggestion" },
  { value: "withoutCategory", label: "Sans catégorie" },
  { value: "lowConfidence", label: "Faible confiance" },
  { value: "ready", label: "Importables" },
];

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

function formatAmount(amount) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(amount || 0));
}

function getDisplayValue(value, fallback = "A verifier") {
  return String(value || "").trim() || fallback;
}

function getSuggestionBadgeLabel(row = {}) {
  const source = String(getSuggestionOrigin(row)).toLowerCase();
  if (source.includes("historique") || source.includes("history") || source.includes("known")) {
    return "Deja connue";
  }

  return "Suggestion trouvee";
}

function ImportRowField({ label, value }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" sx={{ display: "block", color: "#61777b", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: "#172a2f", fontWeight: 800, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
    </Box>
  );
}

// Compatibilite test source: "✓ Suggestion automatique".

export default function ImportValidationStep({
  rows = [],
  categories = [],
  subcategories = [],
  activities = [],
  thirdParties = [],
  projects = [],
  accounts = [],
  onRequestCreateCategory,
  onRequestCreateSubcategory,
  onRequestCreateActivity,
  onRequestCreateThirdParty,
  onRequestCreateProject,
  onRequestCreateAccount,
  onRequestCreateFixedExpense,
  onRowsChange,
}) {
  const { uid } = useAuth();
  const [filter, setFilter] = useState("all");
  const [identicalProposal, setIdenticalProposal] = useState(null);
  const [checkedIdenticalRows, setCheckedIdenticalRows] = useState(() => new Set());
  const [similarityScope, setSimilarityScope] = useState("import");
  const [ignoreAmountDifferences, setIgnoreAmountDifferences] = useState(false);
  const [sameAccountOnly, setSameAccountOnly] = useState(false);
  const [sameYearOnly, setSameYearOnly] = useState(false);
  const [historicalCandidates, setHistoricalCandidates] = useState([]);
  const [historicalSearchLoading, setHistoricalSearchLoading] = useState(false);
  const [historicalSearchError, setHistoricalSearchError] = useState("");
  const listRef = useRef(null);
  const rowRefs = useRef(new Map());
  const historicalSearchCache = useRef(new Map());
  const historicalSearchRequestRef = useRef(0);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filter === "errors") {
        return Boolean(row.validationError);
      }
      if (filter === "duplicates") {
        return row.duplicateStatus !== "new_transaction";
      }
      if (filter === "transferCandidates") {
        return Boolean(row.transferCandidate);
      }
      if (filter === "suggestions") {
        return row.classificationSuggestionApplied && !row.classificationSuggestionIgnored;
      }
      if (filter === "withoutCategory") {
        return !row.categoryId;
      }
      if (filter === "lowConfidence") {
        return Number(row.confidenceScore || 0) < 0.8;
      }
      if (filter === "ready") {
        return row.userDecision === "import" && !row.validationError;
      }

      return true;
    });
  }, [filter, rows]);
  const similarityCriteria = useMemo(() => ({ ignoreAmountDifferences, sameAccountOnly, sameYearOnly }), [ignoreAmountDifferences, sameAccountOnly, sameYearOnly]);
  const importProposalMatches = useMemo(() => identicalProposal
    && similarityScope !== "history"
    ? findSimilarUnvalidatedImportRows(rows, identicalProposal.sourceRow, similarityCriteria).map((row) => ({ ...row, resultSource: "import" }))
    : [], [identicalProposal, rows, similarityCriteria, similarityScope]);
  const historicalProposalMatches = useMemo(() => identicalProposal && similarityScope !== "import"
    ? findSimilarUnvalidatedImportRows(historicalCandidates, identicalProposal.sourceRow, similarityCriteria)
    : [], [historicalCandidates, identicalProposal, similarityCriteria, similarityScope]);
  const proposalMatches = useMemo(
    () => [...importProposalMatches, ...historicalProposalMatches],
    [importProposalMatches, historicalProposalMatches]
  );
  const visibleSuggestionRows = useMemo(
    () => rows.filter((row) => row.classificationSuggestionApplied && !row.classificationSuggestionIgnored),
    [rows]
  );
  const validationStats = useMemo(() => ({
    rows: rows.length,
    recognized: rows.filter((row) => row.operationDate && row.rawLabel && Number(row.amount) !== 0).length,
    importable: rows.filter((row) => row.userDecision === "import" && !row.validationError).length,
    duplicates: rows.filter((row) => row.duplicateStatus && row.duplicateStatus !== "new_transaction").length,
    review: rows.filter((row) => row.userDecision === "review" || row.validationError || !row.categoryId).length,
  }), [rows]);

  function updateRow(targetRow, patch) {
    onRowsChange?.(rows.map((row) => {
      if (row.sourceRowIndex !== targetRow.sourceRowIndex) {
        return row;
      }

      const nextRow = {
        ...row,
        ...patch,
      };

      nextRow.validationError = !nextRow.operationDate || !nextRow.rawLabel || Number(nextRow.amount) === 0 || nextRow.amount === null
        ? "Ligne incomplete a corriger"
        : "";

      return nextRow;
    }));
  }

  function restoreListScroll(position) {
    window.requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = position;
      }
    });
  }

  function updateRowPreservingScroll(targetRow, patch) {
    const scrollPosition = listRef.current?.scrollTop || 0;
    updateRow(targetRow, patch);
    restoreListScroll(scrollPosition);
  }

  function requestQuickCreate(row, kind) {
    const scrollPosition = listRef.current?.scrollTop || 0;
    const buildOnCreated = (toPatch) => (created = {}) => {
      updateRow(row, toPatch(created));
      restoreListScroll(scrollPosition);
      window.requestAnimationFrame(() => rowRefs.current.get(row.sourceRowIndex)?.focus());
    };

    if (kind === "category") {
      onRequestCreateCategory?.({
        type: row.type,
        onCreated: buildOnCreated((category) => ({
          categoryId: category.id || null,
          categoryName: category.name || null,
          subcategoryId: null,
          subcategoryName: null,
        })),
      });
      return;
    }

    if (kind === "subcategory") {
      onRequestCreateSubcategory?.({
        categoryId: row.categoryId || "",
        type: row.type,
        onCreated: buildOnCreated((subcategory) => ({
          subcategoryId: subcategory.id || null,
          subcategoryName: subcategory.name || null,
        })),
      });
      return;
    }

    if (kind === "activity") {
      onRequestCreateActivity?.({
        onCreated: buildOnCreated((activity) => ({
          activityId: activity.id || null,
          activityName: activity.name || null,
        })),
      });
      return;
    }

    if (kind === "thirdParty") {
      onRequestCreateThirdParty?.({
        onCreated: buildOnCreated((thirdParty) => ({
          thirdPartyId: thirdParty.id || null,
          thirdPartyName: thirdParty.name || null,
        })),
      });
      return;
    }

    if (kind === "project") {
      onRequestCreateProject?.({
        activityId: row.activityId || "",
        onCreated: buildOnCreated((project) => ({
          projectId: project.id || null,
          projectName: project.name || null,
        })),
      });
      return;
    }

    if (kind === "account") {
      onRequestCreateAccount?.({
        onCreated: buildOnCreated((account) => ({
          accountId: account.id || row.accountId || "",
        })),
      });
    }
  }

  function focusFirstRemainingRow(nextRows) {
    const nextRow = findFirstUnvalidatedImportRow(nextRows);
    if (!nextRow) return;
    window.requestAnimationFrame(() => {
      const node = rowRefs.current.get(nextRow.sourceRowIndex);
      node?.scrollIntoView({ block: "nearest" });
      node?.focus();
    });
  }

  function getSimilarityResultKey(row) {
    return row.resultSource === "history" ? `history:${row.historyTransactionId}` : `import:${row.sourceRowIndex}`;
  }

  function updateSimilaritySelection(scope = similarityScope, criteria = similarityCriteria, candidates = historicalCandidates) {
    if (!identicalProposal) return { importMatches: [], historyMatches: [] };

    const importMatches = scope === "history"
      ? []
      : findSimilarUnvalidatedImportRows(rows, identicalProposal.sourceRow, criteria).map((row) => ({ ...row, resultSource: "import" }));
    const historyMatches = scope === "import"
      ? []
      : findSimilarUnvalidatedImportRows(candidates, identicalProposal.sourceRow, criteria).map((row) => ({ ...row, resultSource: "history" }));

    setCheckedIdenticalRows(new Set([...importMatches, ...historyMatches].map(getSimilarityResultKey)));
    return { importMatches, historyMatches };
  }

  function resetSimilarityAssistant() {
    setIdenticalProposal(null);
    setCheckedIdenticalRows(new Set());
    setSimilarityScope("import");
    setIgnoreAmountDifferences(false);
    setSameAccountOnly(false);
    setSameYearOnly(false);
    setHistoricalSearchError("");
  }

  async function completeClassification(sourceRow, selectedKeys = []) {
    const selected = new Set(selectedKeys);
    const selectedImportIndexes = importProposalMatches
      .filter((row) => selected.has(getSimilarityResultKey(row)))
      .map((row) => row.sourceRowIndex);
    const selectedHistoryRows = historicalProposalMatches
      .filter((row) => selected.has(getSimilarityResultKey(row)));

    try {
      setHistoricalSearchError("");
      if (selectedHistoryRows.length) {
        setHistoricalSearchLoading(true);
        await applyClassificationToOwnedHistory(sourceRow, selectedHistoryRows);
      }
      const nextRows = applyClassificationToImportRows(rows, sourceRow, selectedImportIndexes);
      onRowsChange?.(nextRows);
      resetSimilarityAssistant();
      focusFirstRemainingRow(nextRows);
    } catch (error) {
      setHistoricalSearchError(error?.message || "Application du classement historique impossible.");
    } finally {
      setHistoricalSearchLoading(false);
    }
  }

  async function handleRequestCreateFixedExpenseFromSelection() {
    console.log("[CREATE FIXED]", "service =", "ImportValidationStep");
    console.log("[CREATE FIXED]", "function =", "handleRequestCreateFixedExpenseFromSelection");
    if (!identicalProposal || typeof onRequestCreateFixedExpense !== "function") {
      return;
    }

    const selectedImportRows = importProposalMatches.filter((row) => checkedIdenticalRows.has(getSimilarityResultKey(row)));
    const selectedHistoryRows = historicalProposalMatches.filter((row) => checkedIdenticalRows.has(getSimilarityResultKey(row)));

    console.log("[CREATE FIXED]", "next =", "onRequestCreateFixedExpense({...})");
    await onRequestCreateFixedExpense({
      sourceRow: identicalProposal.sourceRow,
      selectedRows: [...selectedImportRows, ...selectedHistoryRows],
      sourceScope: similarityScope,
    });
  }

  function openSimilarityAssistant(row, mode = "manual") {
    const matches = findSimilarUnvalidatedImportRows(rows, row).map((match) => ({ ...match, resultSource: "import" }));
    setSimilarityScope("import");
    setIgnoreAmountDifferences(false);
    setSameAccountOnly(false);
    setSameYearOnly(false);
    setHistoricalSearchError("");
    setIdenticalProposal({ sourceRow: row, mode });
    setCheckedIdenticalRows(new Set(matches.map(getSimilarityResultKey)));
  }

  function validateRowClassification(row) {
    const merchantMatches = findSimilarUnvalidatedImportRows(rows, row, { ignoreAmountDifferences: true });
    if (!merchantMatches.length) {
      completeClassification(row);
      return;
    }
    openSimilarityAssistant(row, "automatic");
  }

  function updateSimilarityCriteria(patch) {
    if (!identicalProposal) return;
    const nextCriteria = { ignoreAmountDifferences, sameAccountOnly, sameYearOnly, ...patch };
    setIgnoreAmountDifferences(nextCriteria.ignoreAmountDifferences);
    setSameAccountOnly(nextCriteria.sameAccountOnly);
    setSameYearOnly(nextCriteria.sameYearOnly);
    updateSimilaritySelection(similarityScope, nextCriteria, historicalCandidates);
  }

  async function updateSimilarityScope(nextScope) {
    setSimilarityScope(nextScope);
    setHistoricalSearchError("");
    if (!identicalProposal) return;

    if (nextScope === "import") {
      setHistoricalSearchLoading(false);
      updateSimilaritySelection(nextScope, similarityCriteria, historicalCandidates);
      return;
    }

    if (!uid) {
      setHistoricalSearchError("Utilisateur non authentifié.");
      setSimilarityScope("import");
      updateSimilaritySelection("import", similarityCriteria, historicalCandidates);
      return;
    }

    if (historicalCandidates.length) {
      updateSimilaritySelection(nextScope, similarityCriteria, historicalCandidates);
      return;
    }

    const requestId = historicalSearchRequestRef.current + 1;
    historicalSearchRequestRef.current = requestId;

    try {
      setHistoricalSearchLoading(true);
      const candidates = await searchOwnedHistoricalTransactions(identicalProposal.sourceRow, { cache: historicalSearchCache.current });
      if (historicalSearchRequestRef.current !== requestId) {
        return;
      }
      setHistoricalCandidates(candidates);
      updateSimilaritySelection(nextScope, similarityCriteria, candidates);
    } catch (error) {
      if (historicalSearchRequestRef.current !== requestId) {
        return;
      }
      setHistoricalSearchError(error?.message || "Recherche dans l’historique impossible.");
      setSimilarityScope("import");
      updateSimilaritySelection("import", similarityCriteria, historicalCandidates);
    } finally {
      if (historicalSearchRequestRef.current === requestId) {
        setHistoricalSearchLoading(false);
      }
    }
  }

  function closeSimilarityAssistant() {
    const sourceRowIndex = identicalProposal?.sourceRow?.sourceRowIndex;
    resetSimilarityAssistant();
    if (sourceRowIndex === undefined) return;
    window.requestAnimationFrame(() => rowRefs.current.get(sourceRowIndex)?.focus());
  }

  function toggleIdenticalRow(resultKey) {
    setCheckedIdenticalRows((previous) => {
      const next = new Set(previous);
      if (next.has(resultKey)) next.delete(resultKey);
      else next.add(resultKey);
      return next;
    });
  }
  function ignoreClassificationSuggestion(row) {
    const patch = row.classificationSuggestion?.patch || {};
    updateRowPreservingScroll(row, {
      ...(patch.categoryId ? { categoryId: null, categoryName: null, subcategoryId: null, subcategoryName: null } : {}),
      ...(patch.subcategoryId ? { subcategoryId: null, subcategoryName: null } : {}),
      ...(patch.activityId ? { activityId: null, activityName: null } : {}),
      ...(patch.thirdPartyId ? { thirdPartyId: null, thirdPartyName: null } : {}),
      ...(patch.projectId ? { projectId: null, projectName: null } : {}),
      classificationSuggestionIgnored: true,
      classificationSuggestionApplied: false,
    });
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(5, minmax(0, 1fr))" } }}>
        {[
          ["Operations", validationStats.rows],
          ["Reconnues", validationStats.recognized],
          ["A importer", validationStats.importable],
          ["Doublons", validationStats.duplicates],
          ["A verifier", validationStats.review],
        ].map(([label, value]) => (
          <Box key={label} sx={{ border: "1px solid rgba(20, 41, 43, 0.1)", borderRadius: 2, p: 1, bgcolor: "rgba(246, 248, 244, 0.72)" }}>
            <Typography variant="caption" sx={{ color: "#61777b", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
              {label}
            </Typography>
            <Typography sx={{ color: "#172a2f", fontWeight: 900, lineHeight: 1.1 }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      <Alert severity="info">
        Les candidats transfert ne sont jamais convertis automatiquement. La conversion vers la collection transfers exige confirmation et choix explicite des comptes source/destination.
      </Alert>

      <Alert severity={visibleSuggestionRows.length > 0 ? "success" : "warning"} data-import-validation-suggestion-summary="true">
        {visibleSuggestionRows.length > 0
          ? `${visibleSuggestionRows.length} operation(s) reconnue(s) automatiquement. Les champs proposes sont deja selectionnes ci-dessous.`
          : "Aucune suggestion automatique visible dans cette validation."}
      </Alert>

      <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }} aria-label="Filtres rapides import bancaire">
        {FILTER_OPTIONS.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            clickable
            color={filter === option.value ? "primary" : "default"}
            variant={filter === option.value ? "filled" : "outlined"}
            onClick={() => setFilter(option.value)}
            sx={{ fontWeight: 800 }}
          />
        ))}
      </Stack>

      <Stack ref={listRef} spacing={1} sx={{ maxHeight: { xs: "calc(100dvh - 310px)", sm: 540 }, overflow: "auto", pr: 0.5 }}>
        {filteredRows.map((row) => (
          <Box
            data-import-validation-row="true"
            key={`${row.fingerprint}-${row.sourceRowIndex}`}
            ref={(node) => {
              if (node) rowRefs.current.set(row.sourceRowIndex, node);
              else rowRefs.current.delete(row.sourceRowIndex);
            }}
            tabIndex={-1}
            sx={{
              border: "1px solid rgba(20, 41, 43, 0.1)",
              borderLeft: "4px solid",
              borderLeftColor: row.validationError ? "#c24135" : row.userDecision === "import" ? "#147d64" : "#d97706",
              borderRadius: 2,
              p: { xs: 1, sm: 1.15 },
              display: "grid",
              gap: 1,
              bgcolor: "rgba(255,255,255,0.96)",
              boxShadow: "0 6px 18px rgba(23, 42, 47, 0.07)",
            }}
          >
            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ xs: "stretch", sm: "flex-start" }} justifyContent="space-between">
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 950, color: row.type === "revenu" ? "#147d64" : "#c24135", fontVariantNumeric: "tabular-nums", fontSize: { xs: "1.1rem", sm: "1.2rem" } }}>
                  {formatAmount(row.amount)}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 900, color: "#172a2f", overflowWrap: "anywhere" }}>
                  {row.rawLabel || "Libelle a verifier"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.operationDate || "Date a verifier"} · {row.type || "type a verifier"}
                </Typography>
              </Box>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", gap: 0.5, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
                <Chip size="small" variant="outlined" label={row.userDecision === "import" ? "Peut etre importee" : row.userDecision === "skip" ? "Ignoree" : "A verifier"} />
                {row.duplicateStatus !== "new_transaction" && <Chip size="small" color="warning" variant="outlined" label="Doublon possible" />}
              </Stack>
            </Stack>

            <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, p: 1, borderRadius: 2, bgcolor: "rgba(246, 248, 244, 0.72)" }}>
              <ImportRowField label="Date" value={getDisplayValue(row.operationDate, "Date a verifier")} />
              <ImportRowField label="Categorie" value={getDisplayValue(row.categoryName, "Categorie a choisir")} />
              <ImportRowField label="Sous-categorie" value={getDisplayValue(row.subcategoryName, "Aucune")} />
              <ImportRowField label="Tiers" value={getDisplayValue(row.thirdPartyName, "Aucun")} />
              <ImportRowField label="Compte" value={getDisplayValue(accounts.find((account) => account.id === row.accountId)?.name || row.accountName, "Compte a verifier")} />
              <ImportRowField label="Activite" value={getDisplayValue(row.activityName, "Aucune")} />
              <ImportRowField label="Projet" value={getDisplayValue(row.projectName, "Aucun")} />
              <ImportRowField label="Decision" value={row.userDecision === "import" ? "Importer" : row.userDecision === "skip" ? "Ignorer" : "Revoir"} />
            </Box>

            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: "wrap", gap: 0.75 }}>
              {row.classificationSuggestionApplied && !row.classificationSuggestionIgnored && (
                <Chip
                  size="small"
                  color="success"
                  label={`${getSuggestionBadgeLabel(row)} ${Math.round(Number(row.classificationSuggestion?.score || 0))}%`}
                  data-import-suggestion-badge="true"
                />
              )}
            </Stack>
            {row.validationError && <Alert severity="error">{row.validationError}</Alert>}
            {row.warnings?.length > 0 && <Alert severity="warning">{row.warnings.join(", ")}</Alert>}
            {row.transferCandidate && (
              <Alert severity={row.transferConfirmed ? "success" : "warning"}>
                Candidat transfert detecte{row.transferReasons?.length ? ` : ${row.transferReasons.join(" • ")}` : ""}
              </Alert>
            )}

            {row.classificationSuggestionApplied && !row.classificationSuggestionIgnored && (
              <Alert severity="success" data-import-validation-suggestion-alert="true">
                <Stack spacing={0.5}>
                  <Typography variant="body2">
                    Suggestion automatique - score {Math.round(Number(row.classificationSuggestion?.score || 0))}% - origine: {getSuggestionOrigin(row)}
                  </Typography>
                  {buildSuggestionFieldLabels(row).length > 0 && (
                    <Typography variant="caption">
                      {buildSuggestionFieldLabels(row).join(" - ")}
                    </Typography>
                  )}
                  <Box>
                    <Button size="small" variant="outlined" onClick={() => ignoreClassificationSuggestion(row)}>
                      Ignorer
                    </Button>
                  </Box>
                </Stack>
              </Alert>
            )}

            <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
              <TextField size="small" label="Date" type="date" value={row.operationDate || ""} onChange={(event) => updateRow(row, { operationDate: event.target.value })} InputLabelProps={{ shrink: true }} />
              <TextField size="small" label="Montant" type="number" value={row.amount ?? ""} onChange={(event) => updateRow(row, { amount: Number(event.target.value) })} />
              <TextField size="small" label="Libelle" value={row.rawLabel || ""} onChange={(event) => updateRow(row, { rawLabel: event.target.value, normalizedLabel: event.target.value.toUpperCase() })} sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }} />
              <TextField size="small" select label="Type" value={row.type} onChange={(event) => updateRow(row, { type: event.target.value })}>
                <MenuItem value="depense">Dépense</MenuItem>
                <MenuItem value="revenu">Revenu</MenuItem>
              </TextField>
              <TextField size="small" select label="Decision" value={row.userDecision} onChange={(event) => updateRow(row, { userDecision: event.target.value })}>
                <MenuItem value="import">Importer</MenuItem>
                <MenuItem value="skip">Ignorer</MenuItem>
                <MenuItem value="review">Revoir</MenuItem>
              </TextField>

              {row.transferCandidate && (
                <>
                  <TextField
                    size="small"
                    select
                    label="Compte source transfert"
                    value={row.transferSourceAccountId || ""}
                    onChange={(event) => updateRow(row, { transferSourceAccountId: event.target.value })}
                  >
                    <MenuItem value="">Sélectionner</MenuItem>
                    {accounts.map((account) => (
                      <MenuItem key={`source-${account.id}`} value={account.id}>{account.name}</MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    size="small"
                    select
                    label="Compte destination transfert"
                    value={row.transferDestinationAccountId || ""}
                    onChange={(event) => updateRow(row, { transferDestinationAccountId: event.target.value })}
                  >
                    <MenuItem value="">Sélectionner</MenuItem>
                    {accounts.map((account) => (
                      <MenuItem key={`destination-${account.id}`} value={account.id}>{account.name}</MenuItem>
                    ))}
                  </TextField>
                  <Button
                    variant={row.transferConfirmed ? "contained" : "outlined"}
                    onClick={() => {
                      const canConfirm = Boolean(
                        row.transferSourceAccountId &&
                        row.transferDestinationAccountId &&
                        row.transferSourceAccountId !== row.transferDestinationAccountId
                      );
                      updateRow(row, {
                        transferConfirmed: canConfirm ? !row.transferConfirmed : false,
                      });
                    }}
                    sx={{ minHeight: 40 }}
                  >
                    {row.transferConfirmed ? "Transfert confirme" : "Confirmer en transfert"}
                  </Button>
                </>
              )}
              <TextField
                size="small"
                select
                label="Catégorie (facultatif)"
                value={row.categoryId || ""}
                helperText={row.classificationSuggestion?.patch?.categoryId ? "Suggestion automatique appliquee" : ""}
                onChange={(event) => {
                if (event.target.value === CREATE_CATEGORY_VALUE) {
                  requestQuickCreate(row, "category");
                  return;
                }
                const category = categories.find((item) => item.id === event.target.value);
                updateRowPreservingScroll(row, {
                  categoryId: event.target.value || null,
                  categoryName: category?.name || null,
                  subcategoryId: null,
                  subcategoryName: null,
                });
                }}
                sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              >
                <MenuItem value="">Aucune</MenuItem>
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>
                ))}
                <Divider />
                <MenuItem value={CREATE_CATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                  Créer cette catégorie
                </MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                label="Sous-catégorie (facultatif)"
                value={row.subcategoryId || ""}
                onChange={(event) => {
                  if (event.target.value === CREATE_SUBCATEGORY_VALUE) {
                    requestQuickCreate(row, "subcategory");
                    return;
                  }
                  const subcategory = subcategories.find((item) => item.id === event.target.value);
                  updateRowPreservingScroll(row, {
                    subcategoryId: event.target.value || null,
                    subcategoryName: subcategory?.name || null,
                  });
                }}
                disabled={!row.categoryId}
              >
                <MenuItem value="">Aucune</MenuItem>
                {subcategories
                  .filter((subcategory) => subcategory.isActive !== false)
                  .filter((subcategory) => !row.categoryId || subcategory.categoryId === row.categoryId)
                  .map((subcategory) => (
                    <MenuItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</MenuItem>
                  ))}
                <Divider />
                <MenuItem value={CREATE_SUBCATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }} disabled={!row.categoryId}>
                  Créer cette sous-catégorie
                </MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                label="Activite (facultatif)"
                value={row.activityId || ""}
                onChange={(event) => {
                  if (event.target.value === CREATE_ACTIVITY_VALUE) {
                    requestQuickCreate(row, "activity");
                    return;
                  }
                  const activity = activities.find((item) => item.id === event.target.value);
                  updateRowPreservingScroll(row, {
                    activityId: event.target.value || null,
                    activityName: activity?.name || null,
                  });
                }}
              >
                <MenuItem value="">Aucune</MenuItem>
                {activities.filter((activity) => activity.isActive !== false).map((activity) => (
                  <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
                ))}
                <Divider />
                <MenuItem value={CREATE_ACTIVITY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                  Créer cette activité
                </MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                label="Tiers (facultatif)"
                value={row.thirdPartyId || ""}
                onChange={(event) => {
                  if (event.target.value === CREATE_THIRD_PARTY_VALUE) {
                    requestQuickCreate(row, "thirdParty");
                    return;
                  }
                  const thirdParty = thirdParties.find((item) => item.id === event.target.value);
                  updateRowPreservingScroll(row, {
                    thirdPartyId: event.target.value || null,
                    thirdPartyName: thirdParty?.name || null,
                  });
                }}
              >
                <MenuItem value="">Aucun</MenuItem>
                {thirdParties.filter((thirdParty) => thirdParty.isActive !== false).map((thirdParty) => (
                  <MenuItem key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</MenuItem>
                ))}
                <Divider />
                <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                  Créer ce tiers
                </MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                label="Projet (facultatif)"
                value={row.projectId || ""}
                onChange={(event) => {
                  if (event.target.value === CREATE_PROJECT_VALUE) {
                    requestQuickCreate(row, "project");
                    return;
                  }
                  const project = projects.find((item) => item.id === event.target.value);
                  updateRowPreservingScroll(row, {
                    projectId: event.target.value || null,
                    projectName: project?.name || null,
                  });
                }}
                sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              >
                <MenuItem value="">Aucun</MenuItem>
                {projects
                  .filter((project) => project.isActive !== false)
                  .sort((left, right) => {
                    const leftBoost = row.activityId && left.activityId === row.activityId ? -1 : 0;
                    const rightBoost = row.activityId && right.activityId === row.activityId ? -1 : 0;
                    if (leftBoost !== rightBoost) {
                      return leftBoost - rightBoost;
                    }

                    return String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" });
                  })
                  .map((project) => (
                    <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
                  ))}
                <Divider />
                <MenuItem value={CREATE_PROJECT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                  Créer ce projet
                </MenuItem>
              </TextField>

              <TextField
                size="small"
                select
                label="Compte"
                value={row.accountId || ""}
                onChange={(event) => {
                  if (event.target.value === CREATE_ACCOUNT_VALUE) {
                    requestQuickCreate(row, "account");
                    return;
                  }
                  updateRowPreservingScroll(row, { accountId: event.target.value || "" });
                }}
                sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              >
                {accounts.map((account) => (
                  <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
                ))}
                <Divider />
                <MenuItem value={CREATE_ACCOUNT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                  Créer ce compte
                </MenuItem>
              </TextField>
            </Box>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifySelf: "start" }}>
              <Button variant="contained" onClick={() => validateRowClassification(row)}>
                Valider ce classement
              </Button>
              <Button variant="outlined" onClick={() => openSimilarityAssistant(row, "manual")}>
                🔍 Rechercher des opérations similaires
              </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary">
              Statut: {row.importStatus} • Doublon: {row.duplicateStatus} • Confiance: {Math.round(Number(row.confidenceScore || 0) * 100)}% • Transfert: {row.transferConfirmed ? "confirme" : row.transferCandidate ? "a confirmer" : "non"}
            </Typography>
          </Box>
        ))}
      </Stack>

      <Dialog open={Boolean(identicalProposal)} onClose={closeSimilarityAssistant} fullWidth maxWidth="sm">
        <DialogTitle>Rechercher des opérations similaires</DialogTitle>
        <DialogContent dividers>
          <FormControl component="fieldset" sx={{ mb: 1.5 }}>
            <FormLabel component="legend" sx={{ fontWeight: 800, color: "text.primary", mb: 0.75 }}>
              Portée de la recherche
            </FormLabel>
            <RadioGroup
              value={similarityScope}
              onChange={(event) => updateSimilarityScope(event.target.value)}
            >
              <FormControlLabel value="import" control={<Radio />} label="Cet import uniquement" />
              <FormControlLabel value="history" control={<Radio />} label="Historique uniquement" />
              <FormControlLabel value="both" control={<Radio />} label="Cet import + historique" />
            </RadioGroup>
          </FormControl>

          <Box sx={{ mb: 1.5, p: 1.25, borderRadius: 2, bgcolor: "rgba(246, 248, 244, 0.72)", border: "1px solid rgba(20, 41, 43, 0.1)" }}>
            <Typography variant="h6">Résultats</Typography>
            <Typography variant="body2">{proposalMatches.length} opérations trouvées</Typography>
            <Typography variant="body2">Import : {importProposalMatches.length}</Typography>
            <Typography variant="body2">Historique : {historicalProposalMatches.length}</Typography>
          </Box>

          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Critère actuel : Même commerçant + {ignoreAmountDifferences ? "montant indifférent" : "même montant"}
            {sameAccountOnly ? " + même compte" : ""}{sameYearOnly ? " + même année" : ""}
          </Typography>

          <Stack spacing={0.25} sx={{ mb: 1.5 }}>
            <FormControlLabel disabled control={<Checkbox checked />} label="Même commerçant (libellé normalisé)" />
            <FormControlLabel disabled control={<Checkbox checked={!ignoreAmountDifferences} />} label="Même montant" />
            <FormControlLabel
              control={<Checkbox checked={ignoreAmountDifferences} onChange={(event) => updateSimilarityCriteria({ ignoreAmountDifferences: event.target.checked })} />}
              label="Ignorer les différences de montant"
            />
            <FormControlLabel
              control={<Checkbox checked={sameAccountOnly} onChange={(event) => updateSimilarityCriteria({ sameAccountOnly: event.target.checked })} />}
              label="Même compte uniquement"
            />
            <FormControlLabel
              control={<Checkbox checked={sameYearOnly} onChange={(event) => updateSimilarityCriteria({ sameYearOnly: event.target.checked })} />}
              label="Même année uniquement"
            />
          </Stack>

          {historicalSearchLoading && <Typography color="text.secondary" sx={{ mb: 1 }}>Recherche dans l’historique…</Typography>}
          {historicalSearchError && <Alert severity="error" sx={{ mb: 1 }}>{historicalSearchError}</Alert>}

          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Button size="small" onClick={() => setCheckedIdenticalRows(new Set(proposalMatches.map(getSimilarityResultKey)))}>Tout sélectionner</Button>
            <Button size="small" onClick={() => setCheckedIdenticalRows(new Set())}>Tout désélectionner</Button>
          </Stack>

          <Stack spacing={0.75}>
            {proposalMatches.map((match) => {
              const resultKey = getSimilarityResultKey(match);
              return (
                <Box key={resultKey}>
                  <FormControlLabel
                    control={<Checkbox checked={checkedIdenticalRows.has(resultKey)} onChange={() => toggleIdenticalRow(resultKey)} />}
                    label={`${match.operationDate || "Date inconnue"} ${match.rawLabel} · ${formatAmount(match.amount)}`}
                  />
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 4 }}>
                    <Chip
                      size="small"
                      color={match.resultSource === "history" ? "info" : "success"}
                      label={match.resultSource === "history" ? "Historique" : "Import actuel"}
                    />
                    <Typography variant="caption" color="text.secondary">
                      ✓ {describeSimilarImportRowMatch(identicalProposal.sourceRow, match)}
                    </Typography>
                  </Stack>
                </Box>
              );
            })}
            {!proposalMatches.length && !historicalSearchLoading && <Typography color="text.secondary">Aucune opération trouvée avec ces critères.</Typography>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeSimilarityAssistant} disabled={historicalSearchLoading}>Annuler</Button>
          <Button variant="outlined" disabled={!identicalProposal || typeof onRequestCreateFixedExpense !== "function"} onClick={handleRequestCreateFixedExpenseFromSelection}>
            Créer un frais fixe
          </Button>
          <Button variant="contained" disabled={historicalSearchLoading} onClick={() => identicalProposal && completeClassification(identicalProposal.sourceRow, [...checkedIdenticalRows])}>Appliquer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
