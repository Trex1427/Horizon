import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Download from "@mui/icons-material/Download";
import ReceiptLong from "@mui/icons-material/ReceiptLong";
import {
  deleteBankImportBatch,
  prepareBankImportDeletion,
  subscribeToBankImports,
} from "../services/bankImportsService.js";

function formatDate(value) {
  const candidate = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : value);
  const date = candidate ? new Date(candidate) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "Date inconnue";
  }
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

function resolveImportBatchId(importRecord = {}) {
  return importRecord.importBatchId || importRecord.importId || importRecord.id || "";
}

function downloadJsonReport(report, fileName = "rapport-import.json") {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = window.URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.URL.revokeObjectURL(url);
}

function getReportDeletedCount(report = null) {
  return report?.deletedCount ?? report?.after?.deletedCount ?? 0;
}

function getReportRemainingCount(report = null) {
  return report?.remainingCount ?? report?.after?.remainingCount ?? 0;
}

export default function ImportHistorySection({ accounts = [], transactions = [] }) {
  const [imports, setImports] = useState([]);
  const [error, setError] = useState("");
  const [selectedImport, setSelectedImport] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePreparation, setDeletePreparation] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [lastReport, setLastReport] = useState(null);

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );

  useEffect(() => {
    const unsubscribe = subscribeToBankImports(
      (data) => {
        setImports(data);
        setError("");
      },
      (err) => setError(err?.message || "Erreur lors du chargement de l'historique des imports")
    );

    return () => unsubscribe();
  }, []);

  const selectedBatchId = resolveImportBatchId(selectedImport || {});
  const selectedTransactions = useMemo(() => transactions.filter((transaction) => (
    selectedBatchId && (transaction.importBatchId === selectedBatchId || transaction.importId === selectedBatchId)
  )), [selectedBatchId, transactions]);
  const latestImport = imports[0] || null;

  async function openDeleteConfirmation(importRecord) {
    setDeleteTarget(importRecord);
    setDeleteError("");
    setDeletePreparation(null);
    try {
      const preparation = await prepareBankImportDeletion(importRecord);
      setDeletePreparation(preparation);
    } catch (err) {
      setDeleteError(err?.message || "Impossible de préparer la suppression de cet import.");
    }
  }

  async function confirmDeleteImport() {
    if (!deleteTarget || deleting) {
      return;
    }

    setDeleting(true);
    setDeleteError("");
    try {
      const result = await deleteBankImportBatch({ importRecord: deleteTarget });
      setLastReport(result.report);
      if (!result.success) {
        setDeleteError(`Suppression annulée: ${result.report.error || "garde-fou déclenché"}`);
        return;
      }
      setDeleteTarget(null);
      setDeletePreparation(null);
      setSelectedImport(null);
    } catch (err) {
      setDeleteError(err?.message || "Erreur lors de la suppression de l'import.");
    } finally {
      setDeleting(false);
    }
  }

  function exportReport(importRecord) {
    const report = lastReport?.importBatchId === resolveImportBatchId(importRecord)
      ? lastReport
      : {
          phase: "before",
          importBatchId: resolveImportBatchId(importRecord),
          importId: importRecord.importId || "",
          fileName: importRecord.fileName || importRecord.importFileName || "",
          accountId: importRecord.accountId || importRecord.importAccountId || "",
          importedCount: importRecord.importedCount || 0,
          duplicateCount: importRecord.duplicateCount || 0,
          suggestionAppliedCount: importRecord.suggestionAppliedCount || 0,
          status: importRecord.status || "",
          exportedAt: new Date().toISOString(),
        };
    downloadJsonReport(report, `rapport-${resolveImportBatchId(importRecord) || "import"}.json`);
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {lastReport && (
        <Alert severity={lastReport.after || lastReport.phase === "after" ? "success" : "warning"}>
          Rapport JSON prêt: {getReportDeletedCount(lastReport)} transaction(s) supprimée(s), {getReportRemainingCount(lastReport)} restante(s).
        </Alert>
      )}
      {!error && imports.length === 0 && (
        <Alert severity="info">Aucun import bancaire journalisé pour le moment.</Alert>
      )}

      {latestImport && (
        <Box
          sx={{
            border: "1px solid rgba(15, 95, 143, 0.16)",
            borderRadius: 2,
            p: { xs: 1, sm: 1.25 },
            bgcolor: "rgba(15, 95, 143, 0.06)",
            boxShadow: "0 8px 24px rgba(23, 42, 47, 0.08)",
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: "#0f5f8f", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0 }}>
                Dernier import
              </Typography>
              <Typography variant="subtitle2" sx={{ fontWeight: 900 }} noWrap>
                {latestImport.fileName || latestImport.importFileName || "Import bancaire"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatDate(latestImport.completedAt || latestImport.startedAt)} - {accountMap.get(latestImport.importAccountId || latestImport.accountId)?.name || latestImport.importAccountId || latestImport.accountId || "Compte inconnu"} - {latestImport.importedCount || 0} ligne(s)
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.75}>
              <Button size="small" variant="outlined" onClick={() => setSelectedImport(latestImport)}>
                Voir
              </Button>
              <Button size="small" color="error" variant="outlined" disabled={latestImport.status === "deleted"} onClick={() => openDeleteConfirmation(latestImport)}>
                Annuler
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      <Stack spacing={1.25}>
        {imports.map((item) => {
          const batchId = resolveImportBatchId(item);
          const accountName = accountMap.get(item.importAccountId || item.accountId)?.name || item.importAccountId || item.accountId || "Compte inconnu";
          const isDeleted = item.status === "deleted";
          return (
            <Box
              key={item.id}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
                p: { xs: 1, sm: 1.25 },
                display: "grid",
                gap: 1,
              }}
            >
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {item.fileName || item.importFileName || "Import bancaire"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.completedAt || item.startedAt)} - {accountName} - {batchId}
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", gap: 0.75 }}>
                  <Chip size="small" label={item.status || "inconnu"} color={isDeleted ? "default" : item.status === "completed" ? "success" : "warning"} />
                  <Chip size="small" label={`${item.importedCount || 0} transaction(s)`} />
                  <Chip size="small" label={`${item.duplicateCount || 0} doublon(s)`} />
                  <Chip size="small" label={`${item.suggestionAppliedCount || 0} suggestion(s)`} />
                  <Chip size="small" label={item.userId || "mono-utilisateur"} />
                </Stack>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Button size="small" startIcon={<ReceiptLong />} onClick={() => setSelectedImport(item)}>
                  Voir les transactions
                </Button>
                <Button size="small" startIcon={<Download />} onClick={() => exportReport(item)}>
                  Exporter le rapport
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<Delete />}
                  disabled={isDeleted}
                  onClick={() => openDeleteConfirmation(item)}
                >
                  Supprimer cet import
                </Button>
              </Stack>
            </Box>
          );
        })}
      </Stack>

      <Dialog open={Boolean(selectedImport)} onClose={() => setSelectedImport(null)} fullWidth maxWidth="md">
        <DialogTitle>Transactions de l'import</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {selectedImport?.fileName || selectedImport?.importFileName || "Import bancaire"} - {selectedTransactions.length} transaction(s)
          </Typography>
          <Stack spacing={1} divider={<Divider flexItem />}>
            {selectedTransactions.map((transaction) => (
              <Box key={transaction.id}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {transaction.date} - {transaction.description || "Sans description"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {Number(transaction.montant || 0).toFixed(2)} EUR - {transaction.categoryName || transaction.categorie || "Sans catégorie"}
                </Typography>
              </Box>
            ))}
          </Stack>
          {selectedTransactions.length === 0 && (
            <Alert severity="info">Aucune transaction active trouvée pour ce lot.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedImport(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>Supprimer cet import</DialogTitle>
        <DialogContent>
          <Stack spacing={1}>
            <Alert severity="warning">
              Cette action supprimera uniquement les transactions portant l'identifiant de ce lot. Aucune transaction manuelle, hors lot ou sans identifiant d'import ne sera supprimée.
            </Alert>
            {deleteError && <Alert severity="error">{deleteError}</Alert>}
            <Typography variant="body2"><strong>Fichier:</strong> {deleteTarget?.fileName || deleteTarget?.importFileName || "Import bancaire"}</Typography>
            <Typography variant="body2"><strong>Date:</strong> {formatDate(deleteTarget?.completedAt || deleteTarget?.startedAt)}</Typography>
            <Typography variant="body2"><strong>Compte:</strong> {accountMap.get(deleteTarget?.importAccountId || deleteTarget?.accountId)?.name || deleteTarget?.importAccountId || deleteTarget?.accountId || "Compte inconnu"}</Typography>
            <Typography variant="body2"><strong>Transactions:</strong> {deletePreparation?.plan?.actualCount ?? deleteTarget?.importedCount ?? 0}</Typography>
            {deletePreparation?.plan?.modifiedCount > 0 && (
              <Alert severity="warning">
                {deletePreparation.plan.modifiedCount} transaction(s) ont été modifiée(s) depuis l'import.
              </Alert>
            )}
            {deletePreparation?.plan?.anomalies?.length > 0 && (
              <Alert severity="error">
                Suppression bloquée: {deletePreparation.plan.anomalies.join(", ")}
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Annuler</Button>
          <Button
            onClick={confirmDeleteImport}
            color="error"
            variant="contained"
            disabled={deleting || !deletePreparation?.plan?.canDelete}
          >
            {deletePreparation?.plan?.modifiedCount > 0 ? "Continuer quand même" : "Confirmer la suppression"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
