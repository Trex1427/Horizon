import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ImportHistorySection from "../features/bankingImport/components/ImportHistorySection";
import BetaJournalSection from "../components/BetaJournalSection";
import {
  exportHorizonDataPlaceholder,
  importHorizonBackupPlaceholder,
  resetHorizonData,
} from "../services/maintenanceService";

export default function Paramètres() {
  const [confirmationValue, setConfirmationValue] = useState("");
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceError, setMaintenanceError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runningActionLabel, setRunningActionLabel] = useState("");
  const [progressState, setProgressState] = useState(null);
  const [summary, setSummary] = useState(null);

  const progressPercent = useMemo(() => {
    const totalToDelete = Number(progressState?.totalToDelete || 0);
    const deletedOverall = Number(progressState?.deletedOverall || 0);

    if (totalToDelete <= 0) {
      return null;
    }

    return Math.min(100, Math.round((deletedOverall / totalToDelete) * 100));
  }, [progressState]);

  const canRunFullReset = confirmationValue === "SUPPRIMER" && !isRunning;

  async function handlePlaceholder(action) {
    setMaintenanceError("");
    setSummary(null);

    const result = action === "export"
      ? await exportHorizonDataPlaceholder()
      : await importHorizonBackupPlaceholder();

    setMaintenanceMessage(result.message);
  }

  async function handleReset(mode, actionLabel) {
    setIsRunning(true);
    setRunningActionLabel(actionLabel);
    setMaintenanceMessage("");
    setMaintenanceError("");
    setSummary(null);
    setProgressState({
      phase: "start",
      deletedOverall: 0,
      totalToDelete: 0,
    });

    try {
      const result = await resetHorizonData({
        mode,
        onProgress: (nextProgress) => {
          setProgressState((previous) => ({
            ...previous,
            ...nextProgress,
          }));
        },
      });

      setSummary(result);
      setMaintenanceMessage(result.hadErrors
        ? "Maintenance terminée avec erreurs."
        : "Maintenance terminée avec succès.");
    } catch (error) {
      setMaintenanceError(error?.message || "Erreur pendant la maintenance.");
    } finally {
      setIsRunning(false);
      setRunningActionLabel("");
    }
  }

  return (
    <Box sx={{ display: "grid", gap: 2 }}>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>Paramètres</Typography>

      <Stack spacing={2} divider={<Divider flexItem />}>
        <Box sx={{ display: "grid", gap: 1 }}>
          <Typography variant="h6">À propos</Typography>
          <Typography variant="body2">Horizon</Typography>
          <Typography variant="body2">Version 3.0 Beta ({__APP_VERSION__})</Typography>
          <Typography variant="body2">Build {__BUILD_DATE__}</Typography>
          <Typography variant="body2">Environnement : {__APP_ENV__}</Typography>
        </Box>

        <ImportHistorySection />

        <Box sx={{ display: "grid", gap: 1.25 }}>
          <Typography variant="h6">Maintenance</Typography>
          <Typography variant="body2" color="text.secondary">
            Outils techniques pour préparer une base propre avant la phase bêta.
          </Typography>

          {maintenanceMessage && (
            <Alert severity={summary?.hadErrors ? "warning" : "info"}>{maintenanceMessage}</Alert>
          )}

          {maintenanceError && (
            <Alert severity="error">{maintenanceError}</Alert>
          )}

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ flexWrap: "wrap" }}>
            <Button variant="outlined" disabled={isRunning} onClick={() => handlePlaceholder("export")}>
              Exporter les données (placeholder)
            </Button>
            <Button variant="outlined" disabled={isRunning} onClick={() => handlePlaceholder("import")}>
              Importer une sauvegarde (placeholder)
            </Button>
            <Button variant="outlined" color="warning" disabled={isRunning} onClick={() => handleReset("transactions", "Réinitialiser les transactions")}> 
              Réinitialiser les transactions
            </Button>
            <Button variant="outlined" color="warning" disabled={isRunning} onClick={() => handleReset("imports", "Réinitialiser les imports")}> 
              Réinitialiser les imports
            </Button>
          </Stack>

          <Paper variant="outlined" sx={{ p: 1.25, display: "grid", gap: 1 }}>
            <Typography variant="subtitle2">Réinitialisation complète Horizon</Typography>
            <Typography variant="body2" color="text.secondary">
              Seront supprimés: Transactions, Comptes, Budgets, Frais fixes, Revenus récurrents, Objectifs, Historique des imports et Brouillons.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Collections préservées: catégories système, settings, préférences, thème et version.
            </Typography>

            <TextField
              label="Tapez SUPPRIMER pour confirmer"
              value={confirmationValue}
              onChange={(event) => setConfirmationValue(event.target.value)}
              size="small"
              fullWidth
              disabled={isRunning}
            />

            <Button
              variant="contained"
              color="error"
              disabled={!canRunFullReset}
              onClick={() => handleReset("full", "Réinitialiser complètement Horizon")}
            >
              Réinitialiser complètement Horizon
            </Button>
          </Paper>

          {(isRunning || progressState?.phase === "done") && (
            <Paper variant="outlined" sx={{ p: 1.25, display: "grid", gap: 0.75 }}>
              <Typography variant="subtitle2">
                {isRunning ? `Progression: ${runningActionLabel}` : "Progression terminée"}
              </Typography>

              {progressPercent === null ? (
                <LinearProgress />
              ) : (
                <LinearProgress variant="determinate" value={progressPercent} />
              )}

              <Typography variant="caption" color="text.secondary">
                {progressPercent === null
                  ? "Préparation des suppressions..."
                  : `${Number(progressState?.deletedOverall || 0)} / ${Number(progressState?.totalToDelete || 0)} documents supprimés (${progressPercent}%)`}
              </Typography>

              {progressState?.collection && (
                <Typography variant="caption" color="text.secondary">
                  Collection en cours: {progressState.collection}
                </Typography>
              )}
            </Paper>
          )}

          {summary && (
            <Paper variant="outlined" sx={{ p: 1.25, display: "grid", gap: 0.6 }}>
              <Alert severity={summary.hadErrors ? "error" : "success"}>
                {summary.hadErrors
                  ? "Réinitialisation terminée avec erreurs."
                  : "Réinitialisation terminée sans erreur."}
              </Alert>

              <Typography variant="body2">Transactions supprimées: {summary.perCollection.transactions?.deletedCount || 0}</Typography>
              <Typography variant="body2">Comptes supprimés: {summary.perCollection.accounts?.deletedCount || 0}</Typography>
              <Typography variant="body2">Budgets supprimés: {summary.perCollection.budgets?.deletedCount || 0}</Typography>
              <Typography variant="body2">Frais fixes supprimés: {summary.perCollection.fixedExpenses?.deletedCount || 0}</Typography>
              <Typography variant="body2">Revenus récurrents supprimés: {summary.perCollection.recurringIncome?.deletedCount || 0}</Typography>
              <Typography variant="body2">Objectifs supprimés: {summary.perCollection.objectives?.deletedCount || 0}</Typography>
              <Typography variant="body2">Imports supprimés: {summary.perCollection.bankImports?.deletedCount || 0}</Typography>
              <Typography variant="body2">Brouillons supprimés: {summary.perCollection.transactionDrafts?.deletedCount || 0}</Typography>

              {summary.errors.length > 0 && (
                <Box sx={{ display: "grid", gap: 0.35 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>Erreurs:</Typography>
                  {summary.errors.map((entry) => (
                    <Typography key={`${entry.collection}-${entry.stage}`} variant="caption" color="error">
                      [{entry.stage}] {entry.collection}: {entry.message}
                    </Typography>
                  ))}
                </Box>
              )}
            </Paper>
          )}
        </Box>

        <BetaJournalSection />
      </Stack>
    </Box>
  );
}
