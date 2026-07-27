import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import { getRecurringIncomeApplicableAmount, getRecurringIncomeInitialAmount } from "../utils/recurringIncomeAmount";
import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

function getCategoryIcon(categoryMeta) {
  if (!categoryMeta?.icon) {
    return "◦";
  }

  const icon = String(categoryMeta.icon).trim();

  if (icon.length <= 2 && /[^a-zA-Z0-9]/.test(icon)) {
    return icon;
  }

  return "◦";
}

export function RecurringIncomeCard({ recurringIncome, onEdit, onDelete, accounts = [], categoryMeta = null, enableDoubleClickEdit = false }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setDeleteError("");
    try {
      const result = await onDelete(recurringIncome.id);
      if (result?.success) {
        setDeleteConfirmOpen(false);
        return;
      }
      setDeleteError(result?.error || "Le revenu récurrent n’a pas pu être supprimé.");
    } catch (error) {
      setDeleteError(error?.message || "Le revenu récurrent n’a pas pu être supprimé.");
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenMenu = (event) => {
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  const accountName = useMemo(() => {
    const account = accounts.find((item) => item.id === recurringIncome.accountId);
    return account?.name || "Compte non défini";
  }, [accounts, recurringIncome.accountId]);

  const frequencyLabel = recurringIncome.frequency === "annuel" ? "Annuel" : "Mensuel";
  const periodLabel = useMemo(() => {
    const start = formatTargetDate(recurringIncome.startDate);
    const end = formatTargetDate(recurringIncome.endDate);

    if (start && end) {
      return `Du ${start} au ${end}`;
    }

    if (start) {
      return `À partir du ${start}`;
    }

    return "Période non définie";
  }, [recurringIncome.endDate, recurringIncome.startDate]);

  const today = new Date();
  const targetDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const applicableAmount = getRecurringIncomeApplicableAmount(recurringIncome, targetDate);
  const baseAmount = getRecurringIncomeInitialAmount(recurringIncome);
  const categoryLabel = getSafeCategoryLabel(recurringIncome.categoryName || recurringIncome.category, "Catégorie non définie");
  const endDate = recurringIncome.endDate ? new Date(recurringIncome.endDate) : null;
  const isEnded = endDate && !Number.isNaN(endDate.getTime()) && endDate < today;
  const statusLabel = recurringIncome.isActive === false ? "Inactif" : isEnded ? "Terminé" : "Actif";
  const subtitle = `${categoryLabel} • ${accountName} • ${frequencyLabel} • ${periodLabel}`;

  return (
    <>
      <CompactFinanceCard
        title={recurringIncome.name || "Sans nom"}
        metaPrimary={`${statusLabel} - ${frequencyLabel}`}
        metaSecondary={`${accountName} - ${periodLabel}`}
        details={subtitle}
        amount={`${Number(applicableAmount || 0).toFixed(2)} €`}
        amountColor="success.main"
        categoryIcon={getCategoryIcon(categoryMeta)}
        transactionKind="recurringIncome"
        badges={[
          { label: "Statut", value: statusLabel },
          { label: "Catégorie", value: categoryLabel },
        ]}
        onEditClick={() => onEdit(recurringIncome)}
        onMenuClick={handleOpenMenu}
        enableDoubleClickEdit={enableDoubleClickEdit}
      />

      <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.76rem", sm: "0.8rem" } }}>
          Montant de base : {Number(baseAmount).toFixed(2)} €
        </Typography>

        {Array.isArray(recurringIncome.variations) && recurringIncome.variations.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
            Variations : {recurringIncome.variations.length}
          </Typography>
        )}
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
            onEdit(recurringIncome);
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
        <DialogTitle>Supprimer ce revenu récurrent ?</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action le marquera comme inactif sans supprimer la donnée immédiatement.
          </Typography>
          {deleteError ? <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert> : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? "Suppression..." : "Supprimer"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
