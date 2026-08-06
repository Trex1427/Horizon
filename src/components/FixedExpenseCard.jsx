import { useMemo, useState } from "react";
import {
  Box,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { buildFixedExpenseScheduleSnapshot } from "./fixedExpenseScheduleSnapshot.js";
import {
  buildFixedExpenseGuaranteeLines,
  buildFixedExpenseSynchronizationMetrics,
} from "../utils/fixedExpenseAuditViewModel.js";
import { ConfirmDialog, SecondaryButton } from "./ui";

export function FixedExpenseCard({ fixedExpense, onEdit, onDelete, onViewTransactions, accounts = [], transactions = [], transactionIndex = null, reconciliationSummary = null, enableDoubleClickEdit = false }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);

  const handleDelete = async () => {
    await onDelete(fixedExpense.id);
    setDeleteConfirmOpen(false);
  };

  const handleOpenMenu = (event) => {
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  const accountName = useMemo(() => {
    const account = accounts.find((item) => item.id === fixedExpense.accountId);
    return account?.name || "Compte non défini";
  }, [accounts, fixedExpense.accountId]);

  const scheduleSnapshot = useMemo(() => buildFixedExpenseScheduleSnapshot({
    fixedExpense,
    transactions,
    transactionIndex,
    referenceDate: new Date(),
  }), [fixedExpense, transactions, transactionIndex]);

  const frequencyLabel = scheduleSnapshot.frequency === "annual"
    ? "Annuel"
    : scheduleSnapshot.frequency === "weekly"
      ? "Hebdomadaire"
      : "Mensuel";
  const periodLabel = useMemo(() => {
    const start = formatTargetDate(fixedExpense.startDate);
    const end = formatTargetDate(fixedExpense.endDate);

    if (start && end) {
      return `Du ${start} au ${end}`;
    }

    if (start) {
      return `À partir du ${start}`;
    }

    return "Période non définie";
  }, [fixedExpense.endDate, fixedExpense.startDate]);

  const baseCategoryLabel = getSafeCategoryLabel(fixedExpense.categoryName || fixedExpense.category, "Catégorie non définie");
  const categoryLabel = fixedExpense.subcategoryName
    ? `${baseCategoryLabel} · ${fixedExpense.subcategoryName}`
    : baseCategoryLabel;
  const statusLabel = fixedExpense.isActive === false ? "Inactif" : "Actif";
  const subtitle = `${categoryLabel} • ${accountName} • ${frequencyLabel} • ${periodLabel}`;

  const nextEstimatedDateLabel = scheduleSnapshot.nextEstimatedDate
    ? formatTargetDate(scheduleSnapshot.nextEstimatedDate)
    : "Estimation indisponible";
  const synchronizationMetrics = useMemo(
    () => buildFixedExpenseSynchronizationMetrics(reconciliationSummary),
    [reconciliationSummary]
  );
  const guaranteeLines = useMemo(() => buildFixedExpenseGuaranteeLines(reconciliationSummary), [reconciliationSummary]);
  const synchronizationRatio = synchronizationMetrics.occurrenceCount > 0
    ? Math.round((synchronizationMetrics.transactionCount / synchronizationMetrics.occurrenceCount) * 100)
    : 0;

  return (
    <>
      <CompactFinanceCard
        title={fixedExpense.name || "Sans nom"}
        subtitle={subtitle}
        amount={`${Number(fixedExpense.initialAmount || 0).toFixed(2)} €`}
        amountColor="text.primary"
        categoryIcon="◦"
        transactionKind="fixedExpense"
        badges={[
          { label: "Statut", value: statusLabel },
        ]}
        onOpenClick={() => onViewTransactions?.(fixedExpense)}
        onEditClick={() => onEdit(fixedExpense)}
        onMenuClick={handleOpenMenu}
        enableDoubleClickEdit={false}
      />

      <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
        <Stack spacing={0.55}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.76rem", sm: "0.82rem" } }} noWrap>
              {categoryLabel} · Prochaine échéance {nextEstimatedDateLabel}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 800, color: scheduleSnapshot.status.color, fontSize: { xs: "0.76rem", sm: "0.82rem" } }} noWrap>
              {scheduleSnapshot.status.label}
            </Typography>
          </Stack>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(23, 42, 47, 0.08)", overflow: "hidden" }}>
            <Box
              sx={{
                width: `${Math.max(8, Math.min(100, synchronizationRatio))}%`,
                height: "100%",
                bgcolor: scheduleSnapshot.status.color,
              }}
            />
          </Box>
          {reconciliationSummary ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {synchronizationMetrics.transactionCount} transaction(s) suivie(s) · {synchronizationMetrics.forecastCount} prévision(s)
            </Typography>
          ) : null}
          {reconciliationSummary && guaranteeLines.length > 0 ? (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
              {guaranteeLines[0]}
            </Typography>
          ) : null}
          {onViewTransactions ? (
            <SecondaryButton onClick={() => onViewTransactions?.(fixedExpense)}>
              Voir le détail
            </SecondaryButton>
          ) : null}
        </Stack>
      </Box>

      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={handleCloseMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            onEdit(fixedExpense);
            handleCloseMenu();
          }}
        >
          Modifier
        </MenuItem>
        {onViewTransactions && (
          <MenuItem
            onClick={() => {
              onViewTransactions(fixedExpense);
              handleCloseMenu();
            }}
          >
            Voir l'audit
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setDeleteConfirmOpen(true);
            handleCloseMenu();
          }}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer ce frais fixe ?"
        message="Cette action le marquera comme inactif sans supprimer la donnée immédiatement."
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        onConfirm={handleDelete}
        onClose={() => setDeleteConfirmOpen(false)}
        variant="danger"
      />
    </>
  );
}
