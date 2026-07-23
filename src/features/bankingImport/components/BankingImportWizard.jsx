import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
  useMediaQuery,
} from "@mui/material";
import ImportFileStep from "./ImportFileStep";
import ImportMappingStep from "./ImportMappingStep";
import ImportPreviewStep from "./ImportPreviewStep";
import ImportDuplicateStep from "./ImportDuplicateStep";
import ImportValidationStep from "./ImportValidationStep";
import ImportSummaryStep from "./ImportSummaryStep";
import { analyzeBankFile, buildBankImportPreview, buildBankImportValidationRows } from "../services/bankingImportService.js";
import { commitValidatedBankImport } from "../services/importCommitService.js";
import { computeImportReconciliation, detectRecurringCandidates } from "../services/importInsightsService.js";
import { validateCsvPreview, validateImportAccount, validatePreviewableFile } from "../utils/importValidation.js";

const STEP_FILE = 0;
const STEP_MAPPING = 1;
const STEP_PREVIEW = 2;
const STEP_DUPLICATES = 3;
const STEP_VALIDATION = 4;
const STEP_SUMMARY = 5;

const PROGRESS_STEPS = [
  "Choisir le fichier",
  "Verifier les operations",
  "Verifier les doublons",
  "Valider",
  "Import termine",
];

function getProgressStep(activeStep) {
  if (activeStep <= STEP_MAPPING) {
    return 0;
  }

  if (activeStep === STEP_PREVIEW) {
    return 1;
  }

  if (activeStep === STEP_DUPLICATES) {
    return 2;
  }

  if (activeStep === STEP_VALIDATION) {
    return 3;
  }

  return 4;
}

function countImportStats(rows = []) {
  return rows.reduce((stats, row) => {
    const hasSuggestion = row.classificationSuggestionApplied && !row.classificationSuggestionIgnored;
    const isDuplicate = row.duplicateStatus && row.duplicateStatus !== "new_transaction";
    const isImportable = row.userDecision === "import" && !row.validationError;
    const needsReview = row.userDecision === "review" || Boolean(row.validationError) || !row.categoryId;

    return {
      rows: stats.rows + 1,
      recognized: stats.recognized + (row.operationDate && row.rawLabel && Number(row.amount) !== 0 ? 1 : 0),
      suggestions: stats.suggestions + (hasSuggestion ? 1 : 0),
      duplicates: stats.duplicates + (isDuplicate ? 1 : 0),
      importable: stats.importable + (isImportable ? 1 : 0),
      review: stats.review + (needsReview ? 1 : 0),
    };
  }, {
    rows: 0,
    recognized: 0,
    suggestions: 0,
    duplicates: 0,
    importable: 0,
    review: 0,
  });
}

function ImportProgressStepper({ activeStep = 0 }) {
  const progressStep = getProgressStep(activeStep);

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(5, minmax(0, 1fr))" }, gap: 0.75, mb: 1.25 }}>
      {PROGRESS_STEPS.map((label, index) => {
        const isDone = index < progressStep;
        const isCurrent = index === progressStep;
        const marker = isDone ? "✓" : isCurrent ? "●" : "○";
        return (
          <Box
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            sx={{
              border: "1px solid",
              borderColor: isDone ? "rgba(20, 125, 100, 0.28)" : isCurrent ? "rgba(15, 95, 143, 0.32)" : "rgba(20, 41, 43, 0.12)",
              borderRadius: 2,
              px: 1,
              py: 0.75,
              bgcolor: isDone ? "rgba(20, 125, 100, 0.08)" : isCurrent ? "rgba(15, 95, 143, 0.08)" : "rgba(246, 248, 244, 0.72)",
            }}
          >
            <Typography variant="caption" sx={{ display: "block", fontWeight: 900, color: isDone ? "#147d64" : isCurrent ? "#0f5f8f" : "#61777b" }}>
              {marker} {index + 1}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: "#172a2f", lineHeight: 1.15 }}>
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function ImportStatusHeader({ fileName, accountName, stats }) {
  return (
    <Card sx={{ mb: 1.25, borderRadius: 2, border: "1px solid rgba(20, 41, 43, 0.1)", boxShadow: "0 8px 24px rgba(23, 42, 47, 0.08)" }}>
      <CardContent sx={{ py: 1.25, px: { xs: 1.25, sm: 1.5 }, "&:last-child": { pb: 1.25 } }}>
        <Box sx={{ display: "grid", gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: "#172a2f", lineHeight: 1.2 }}>
              Import du releve bancaire
            </Typography>
            <Typography variant="body2" sx={{ color: "#61777b", fontWeight: 700, overflowWrap: "anywhere" }}>
              {fileName || "Choisissez un fichier pour commencer"}
            </Typography>
          </Box>
          <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "1fr", sm: "minmax(180px, 0.8fr) 1fr" } }}>
            <Box>
              <Typography variant="caption" sx={{ display: "block", color: "#61777b", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
                Compte
              </Typography>
              <Typography sx={{ color: "#172a2f", fontWeight: 900 }}>
                {accountName || "Compte a choisir"}
              </Typography>
            </Box>
            <Stack spacing={0.35}>
              <Typography sx={{ color: "#172a2f", fontWeight: 900 }}>
                {stats.rows} operation{stats.rows > 1 ? "s" : ""} detectee{stats.rows > 1 ? "s" : ""}
              </Typography>
              <Typography variant="body2" sx={{ color: "#147d64", fontWeight: 800 }}>
                ✓ {stats.importable} operation{stats.importable > 1 ? "s" : ""} pourront etre importees
              </Typography>
              <Typography variant="body2" sx={{ color: "#147d64", fontWeight: 800 }}>
                ✓ {stats.suggestions} suggestion{stats.suggestions > 1 ? "s" : ""} automatique{stats.suggestions > 1 ? "s" : ""} trouvee{stats.suggestions > 1 ? "s" : ""}
              </Typography>
              <Typography variant="body2" sx={{ color: stats.duplicates > 0 ? "#d97706" : "#147d64", fontWeight: 800 }}>
                {stats.duplicates > 0
                  ? `! ${stats.duplicates} doublon${stats.duplicates > 1 ? "s" : ""} probable${stats.duplicates > 1 ? "s" : ""} a verifier`
                  : "✓ Aucun doublon detecte"}
              </Typography>
            </Stack>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function logWizardDiagnostic(payload = {}) {
  if (typeof console === "undefined") {
    return;
  }

  console.info("[bank-import:wizard-diagnostic]", payload);
  if (typeof window !== "undefined") {
    window.__horizonBankImportDiagnostics = window.__horizonBankImportDiagnostics || [];
    window.__horizonBankImportDiagnostics.push(payload);
  }
}

export default function BankingImportWizard({
  open,
  onClose,
  accounts = [],
  defaultAccountId = "",
  existingTransactions = [],
  categories = [],
  subcategories = [],
  activities = [],
  thirdParties = [],
  projects = [],
  onRequestCreateCategory,
  onRequestCreateSubcategory,
  onRequestCreateActivity,
  onRequestCreateThirdParty,
  onRequestCreateProject,
  onRequestCreateAccount,
  onImportCompleted,
}) {
  const isMobile = useMediaQuery("(max-width:600px)");
  const [activeStep, setActiveStep] = useState(STEP_FILE);
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisState, setAnalysisState] = useState(null);
  const [selectedAccountId, setSelectedAccountId] = useState(defaultAccountId || "");
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState(null);
  const [validationRows, setValidationRows] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setActiveStep(STEP_FILE);
      setSelectedFile(null);
      setAnalysisState(null);
      setSelectedAccountId(defaultAccountId || "");
      setMapping({});
      setPreview(null);
      setValidationRows([]);
      setImportResult(null);
      setLoading(false);
      setError("");
    }
  }, [defaultAccountId, open]);

  const selectedAccountName = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId)?.name || "",
    [accounts, selectedAccountId]
  );
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );
  const reconciliation = useMemo(
    () => computeImportReconciliation({
      account: selectedAccount,
      existingTransactions,
      importRows: validationRows,
      statementBalance: preview?.statementBalance,
    }),
    [existingTransactions, preview?.statementBalance, selectedAccount, validationRows]
  );
  const recurringCandidates = useMemo(() => detectRecurringCandidates(validationRows), [validationRows]);
  const canCommit = useMemo(() => {
    const hasImportRows = validationRows.some((row) => row.userDecision === "import");
    const hasReviewRows = validationRows.some((row) => row.userDecision === "review");
    const hasErrorsOnImportRows = validationRows.some((row) => row.userDecision === "import" && row.validationError);
    return hasImportRows && !hasReviewRows && !hasErrorsOnImportRows;
  }, [validationRows]);
  const importStats = useMemo(() => countImportStats(validationRows), [validationRows]);

  async function handleFileSelected(file) {
    logWizardDiagnostic({
      stage: "file-selected",
      input: {
        name: file?.name || "",
        type: file?.type || "",
        size: file?.size || 0,
      },
      fileReader: "not-used",
      arrayBuffer: "pending",
    });
    setSelectedFile(file);
    setPreview(null);
    setError(validatePreviewableFile(file));

    if (!file) {
      setAnalysisState(null);
      return;
    }

    setLoading(true);
    try {
      const analysis = await analyzeBankFile(file);
      logWizardDiagnostic({
        stage: "analysis-complete",
        output: {
          formatInfo: analysis.formatInfo,
          hasContent: Boolean(analysis.content),
          contentLength: analysis.content?.length || 0,
          analysisRowCount: analysis.analysis?.rowCount ?? null,
          headers: analysis.analysis?.headers || [],
        },
        arrayBuffer: "read",
        error: "",
      });
      setAnalysisState(analysis);
      setMapping(analysis.analysis?.mapping || {});
      setError(analysis.formatInfo.supported ? "" : "Ce format est detecte mais seuls les fichiers CSV et PDF Revolut peuvent etre verifies pour le moment.");
    } catch (err) {
      logWizardDiagnostic({
        stage: "analysis-error",
        error: err?.message || "Erreur lors de l'analyse du fichier.",
      });
      setAnalysisState(null);
      setError(err?.message || "Erreur lors de l'analyse du fichier.");
    } finally {
      setLoading(false);
    }
  }

  function handleNextFromFile() {
    if (!selectedFile) {
      setError("Selectionnez un fichier avant de continuer.");
      return;
    }

    if (!analysisState?.formatInfo?.supported) {
      setError("Seuls les formats CSV et PDF Revolut sont pris en charge dans cette version.");
      return;
    }

    setActiveStep(STEP_MAPPING);
  }

  function handleMappingChange(field, value) {
    setMapping((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  function handleBack() {
    if (activeStep === STEP_MAPPING) {
      setActiveStep(STEP_FILE);
      return;
    }

    if (activeStep === STEP_PREVIEW) {
      setActiveStep(STEP_MAPPING);
      return;
    }

    if (activeStep === STEP_DUPLICATES) {
      setActiveStep(STEP_PREVIEW);
      return;
    }

    if (activeStep === STEP_VALIDATION) {
      setActiveStep(STEP_DUPLICATES);
    }
  }

  function handleClose() {
    if (!loading) {
      onClose?.();
    }
  }

  function handleBuildPreview() {
    if (!validateImportAccount(selectedAccountId)) {
      setError("Selectionnez un compte Horizon avant de verifier les operations.");
      return;
    }

    if (!analysisState?.analysis?.headers?.length) {
      setError("Structure du releve indisponible.");
      return;
    }

    try {
      const nextPreview = buildBankImportPreview({
        format: analysisState.formatInfo.format,
        content: analysisState.content,
        fileName: selectedFile?.name || "",
        accountId: selectedAccountId,
        mapping,
        structureKey: analysisState.analysis.structureKey,
      });
      logWizardDiagnostic({
        stage: "preview-complete",
        output: {
          transactionCount: nextPreview.transactions.length,
          statementPeriod: nextPreview.statementPeriod || null,
          statementSummary: nextPreview.statementSummary || null,
        },
        error: "",
      });

      const previewValidationMessage = analysisState.formatInfo.format === "csv"
        ? validateCsvPreview(nextPreview)
        : "";
      if (previewValidationMessage) {
        setError(previewValidationMessage);
        return;
      }

      setPreview(nextPreview);
      const nextValidationRows = buildBankImportValidationRows({
        preview: nextPreview,
        existingTransactions,
        categories,
        subcategories,
        activities,
        thirdParties,
        projects,
        accounts,
      });
      logWizardDiagnostic({
        stage: "validation-rows-complete",
        output: {
          rowCount: nextValidationRows.length,
          importableCount: nextValidationRows.filter((row) => row.userDecision === "import" && !row.validationError).length,
          rejectedCount: nextValidationRows.filter((row) => row.userDecision !== "import" || row.validationError).length,
        },
        error: "",
      });
      setValidationRows(nextValidationRows);
      setError("");
      setActiveStep(STEP_PREVIEW);
    } catch (err) {
      logWizardDiagnostic({
        stage: "preview-error",
        error: err?.message || "Erreur lors de la preparation des operations.",
      });
      setError(err?.message || "Erreur lors de la preparation des operations.");
    }
  }

  function handleApplyDuplicateDecision(targetStatus, decision) {
    setValidationRows((previous) => previous.map((row) => (
      row.duplicateStatus === targetStatus
        ? { ...row, userDecision: decision }
        : row
    )));
  }

  async function handleCommitImport() {
    setLoading(true);
    setError("");

    try {
      const result = await commitValidatedBankImport({
        rows: validationRows,
        fileName: selectedFile?.name || "",
        format: preview?.format || "csv",
        sourceBank: null,
        accountId: selectedAccountId,
      });

      setImportResult(result);
      setActiveStep(STEP_SUMMARY);
      onImportCompleted?.(result);
    } catch (err) {
      setError(err?.message || "Erreur lors de l'import.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth fullScreen={isMobile} maxWidth="lg">
      <DialogTitle>Importer un releve bancaire</DialogTitle>
      <DialogContent sx={{ pt: 1.5, overflowX: "hidden" }}>
        {loading && <LinearProgress sx={{ mb: 1.25 }} />}

        <ImportStatusHeader fileName={selectedFile?.name || ""} accountName={selectedAccountName} stats={importStats} />

        {error && (
          <Alert severity="error" sx={{ mb: 1.25 }}>{error}</Alert>
        )}

        <ImportProgressStepper activeStep={activeStep} />

        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 4,
            mb: 1.25,
            border: "1px solid rgba(15, 95, 143, 0.14)",
            borderRadius: 2,
            bgcolor: "rgba(255,255,255,0.96)",
            boxShadow: "0 8px 24px rgba(23, 42, 47, 0.1)",
            backdropFilter: "blur(8px)",
            px: 1,
            py: 0.75,
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
              <Chip size="small" label={`${importStats.rows} operations`} />
              <Chip size="small" color="success" variant="outlined" label={`${importStats.suggestions} reconnues automatiquement`} />
              <Chip size="small" color="warning" variant="outlined" label={`${importStats.review} necessitent une verification`} />
              <Chip size="small" color={importStats.duplicates > 0 ? "warning" : "success"} variant="outlined" label={`${importStats.duplicates} doublon${importStats.duplicates > 1 ? "s" : ""}`} />
            </Stack>
            <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", justifyContent: { xs: "flex-end", sm: "flex-start" } }}>
              {activeStep !== STEP_FILE && activeStep !== STEP_SUMMARY && (
                <Button size="small" onClick={handleBack} disabled={loading}>Retour</Button>
              )}
              {activeStep === STEP_VALIDATION && (
                <Button size="small" onClick={() => setValidationRows((previous) => previous.map((row) => ({ ...row, userDecision: "import" })))} disabled={loading}>
                  Tout selectionner
                </Button>
              )}
              {activeStep === STEP_VALIDATION && (
                <Button size="small" variant="contained" onClick={handleCommitImport} disabled={loading || !canCommit}>Valider</Button>
              )}
            </Stack>
          </Stack>
        </Box>

        <Box sx={{ minHeight: 320, overflowX: "hidden" }}>
          {activeStep === STEP_FILE && (
            <ImportFileStep
              fileName={selectedFile?.name || ""}
              formatInfo={analysisState?.formatInfo || null}
              error=""
              onFileSelected={handleFileSelected}
            />
          )}

          {activeStep === STEP_MAPPING && analysisState?.analysis && (
            <ImportMappingStep
              accounts={accounts}
              accountId={selectedAccountId}
              format={analysisState.formatInfo.format}
              headers={analysisState.analysis.headers}
              mapping={mapping}
              requiresMapping={analysisState.analysis.requiresMapping}
              onAccountChange={setSelectedAccountId}
              onMappingChange={handleMappingChange}
            />
          )}

          {activeStep === STEP_PREVIEW && (
            <ImportPreviewStep preview={preview} accountName={selectedAccountName} validationRows={validationRows} />
          )}

          {activeStep === STEP_DUPLICATES && (
            <ImportDuplicateStep rows={validationRows} onApplyDecision={handleApplyDuplicateDecision} onContinue={() => setActiveStep(STEP_VALIDATION)} />
          )}

          {activeStep === STEP_VALIDATION && (
            <ImportValidationStep
              rows={validationRows}
              categories={categories}
              subcategories={subcategories}
              activities={activities}
              thirdParties={thirdParties}
              projects={projects}
              accounts={accounts}
              onRequestCreateCategory={onRequestCreateCategory}
              onRequestCreateSubcategory={onRequestCreateSubcategory}
              onRequestCreateActivity={onRequestCreateActivity}
              onRequestCreateThirdParty={onRequestCreateThirdParty}
              onRequestCreateProject={onRequestCreateProject}
              onRequestCreateAccount={onRequestCreateAccount}
              onRowsChange={setValidationRows}
            />
          )}

          {activeStep === STEP_SUMMARY && (
            <ImportSummaryStep
              result={importResult}
              recurringCandidates={recurringCandidates}
              reconciliation={reconciliation}
              onClose={handleClose}
              onViewTransactions={handleClose}
              onViewHistory={handleClose}
            />
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Fermer</Button>
        {activeStep !== STEP_FILE && activeStep !== STEP_SUMMARY && (
          <Button onClick={handleBack} disabled={loading}>Retour</Button>
        )}
        {activeStep === STEP_FILE && (
          <Button onClick={handleNextFromFile} variant="contained" disabled={loading}>Continuer</Button>
        )}
        {activeStep === STEP_MAPPING && (
          <Button onClick={handleBuildPreview} variant="contained" disabled={loading}>Verifier les operations</Button>
        )}
        {activeStep === STEP_PREVIEW && (
          <Button onClick={() => setActiveStep(STEP_DUPLICATES)} variant="contained" disabled={loading}>Continuer</Button>
        )}
        {activeStep === STEP_VALIDATION && (
          <Button onClick={handleCommitImport} variant="contained" disabled={loading || !canCommit}>Valider</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
