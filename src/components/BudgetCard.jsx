import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  LinearProgress,
  Typography,
} from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import { calculateBudgetMetrics } from "../services/budgetsService";
import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { PILOTAGE_PROGRESS_SX } from "./PilotagePageLayout";

export function BudgetCard({ budget, onEdit, onDelete, transactions = [], enableDoubleClickEdit = false }) {
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

  const subtitle = `${budget.name || "Budget"} • ${periodLabel}`;

  return (
    <>
      <CompactFinanceCard
        title={getSafeCategoryLabel(budget.categoryName || budget.name, "Catégorie non définie")}
        subtitle={subtitle}
        amount={`${Number(metrics.plannedAmount || 0).toFixed(2)} €`}
        amountColor={metrics.color}
        categoryIcon="◦"
        onEditClick={() => onEdit(budget)}
        onMenuClick={handleOpenMenu}
        enableDoubleClickEdit={enableDoubleClickEdit}
      />

      <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 0.75, mb: 0.9 }}>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
            Dépensé : {Number(metrics.spentAmount || 0).toFixed(2)} €
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
            Restant : {Number(metrics.remainingAmount || 0).toFixed(2)} €
          </Typography>
          <Typography variant="body2" sx={{ color: metrics.color, fontSize: { xs: "0.74rem", sm: "0.8rem" } }} noWrap>
            Consommé : {metrics.consumedPercent.toFixed(0)} %
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={Math.min(metrics.consumedPercent, 100)}
          color={metrics.color === "error.main" ? "error" : metrics.color === "warning.main" ? "warning" : "success"}
          aria-label={`Progression du budget ${getSafeCategoryLabel(budget.categoryName || budget.name, "Catégorie non définie")}`}
          sx={PILOTAGE_PROGRESS_SX}
        />
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

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Supprimer ce budget ?</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action le marquera comme inactif sans supprimer la donnée immédiatement.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
