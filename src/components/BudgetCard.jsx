import { useMemo, useState } from "react";
import {
  Box,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import { calculateBudgetMetrics } from "../services/budgetsService";
import { getBudgetPeriodicityLabel, getBudgetTrackingLabel } from "../services/budgetModel.js";
import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { ConfirmDialog } from "./ui";

export function BudgetCard({ budget, onEdit, onDelete, onOpenDetails, transactions = [], enableDoubleClickEdit = false }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);

  const metrics = useMemo(() => calculateBudgetMetrics(budget, transactions), [budget, transactions]);

  const handleDelete = async () => {
    await onDelete(budget.id);
    setDeleteConfirmOpen(false);
  };

  const handleOpenMenu = (event) => {
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  const periodLabel = useMemo(() => {
    const start = formatTargetDate(budget.startDate);
    const end = formatTargetDate(budget.endDate);

    if (start && end) {
      return `Du ${start} au ${end}`;
    }

    if (start) {
      return `À partir du ${start}`;
    }

    return "Période non définie";
  }, [budget.endDate, budget.startDate]);

  const budgetScopeLabel = [
    getSafeCategoryLabel(budget.categoryName || budget.name, "Catégorie non définie"),
    budget.subcategoryName,
  ].filter(Boolean).join(" · ");
  const subtitle = budget.name || "Budget";
  const periodicityLabel = getBudgetPeriodicityLabel(budget.periodicity || "annual");
  const trackingLabel = getBudgetTrackingLabel(budget.rollingPeriod);
  const progressValue = Math.max(0, Math.min(Number(metrics.consumedPercent || 0), 100));
  const statusTone = metrics.consumedPercent > 100 ? "error.main" : metrics.consumedPercent >= 75 ? "warning.main" : "success.main";
  const statusLabel = metrics.consumedPercent > 100 ? "Dépassement" : metrics.consumedPercent >= 75 ? "Surveillance" : "Maîtrisé";

  return (
    <>
      <CompactFinanceCard
        title={budgetScopeLabel}
        subtitle={subtitle}
        amount={`${Number(metrics.plannedAmount || 0).toFixed(2)} €`}
        amountColor={metrics.color}
        categoryIcon="◦"
        transactionKind="expense"
        badges={[
          { label: "Statut", value: statusLabel },
        ]}
        onOpenClick={() => onOpenDetails?.(budget)}
        onEditClick={() => onEdit(budget)}
        onMenuClick={handleOpenMenu}
        enableDoubleClickEdit={false}
      />

      <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
        <Stack spacing={0.45}>
          <Box sx={{ height: 8, borderRadius: 999, bgcolor: "rgba(23, 42, 47, 0.08)", overflow: "hidden" }} aria-label={`Progression du budget ${budgetScopeLabel}`}>
            <Box
              sx={{
                width: `${progressValue}%`,
                height: "100%",
                borderRadius: 999,
                bgcolor: statusTone,
                transition: "width 240ms ease",
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.76rem", sm: "0.82rem" } }} noWrap>
            {periodicityLabel} · {trackingLabel} · Consommé {Number(metrics.spentAmount || 0).toFixed(2)} €
          </Typography>
          <Typography variant="body2" sx={{ color: statusTone, fontWeight: 800, fontSize: { xs: "0.76rem", sm: "0.82rem" } }} noWrap>
            {metrics.consumedPercent.toFixed(0)} % · Restant {Number(metrics.remainingAmount || 0).toFixed(2)} €
          </Typography>
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
            onEdit(budget);
            handleCloseMenu();
          }}
        >
          Modifier
        </MenuItem>
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
        title="Supprimer ce budget ?"
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
