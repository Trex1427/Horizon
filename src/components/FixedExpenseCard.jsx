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
  Typography,
} from "@mui/material";
import { formatTargetDate } from "../utils/dateFormatter";
import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

export function FixedExpenseCard({ fixedExpense, onEdit, onDelete, accounts = [], enableDoubleClickEdit = false }) {
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

  const frequencyLabel = fixedExpense.frequency === "annual" ? "Annuel" : "Mensuel";
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

  return (
    <>
      <CompactFinanceCard
        title={fixedExpense.name || "Sans nom"}
        metaPrimary={`${statusLabel} - ${frequencyLabel}`}
        metaSecondary={`${accountName} - ${periodLabel}`}
        details={subtitle}
        amount={`${Number(fixedExpense.initialAmount || 0).toFixed(2)} €`}
        amountColor="text.primary"
        categoryIcon="◦"
        transactionKind="fixedExpense"
        badges={[
          { label: "Statut", value: statusLabel },
          { label: "Catégorie", value: categoryLabel },
        ]}
        onEditClick={() => onEdit(fixedExpense)}
        onMenuClick={handleOpenMenu}
        enableDoubleClickEdit={enableDoubleClickEdit}
      />

      <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
        {fixedExpense.description && (
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.76rem", sm: "0.8rem" } }}>
            {fixedExpense.description}
          </Typography>
        )}

        {Array.isArray(fixedExpense.variations) && fixedExpense.variations.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.4 }}>
            Variations : {fixedExpense.variations.length}
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
            onEdit(fixedExpense);
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
        <DialogTitle>Supprimer ce frais fixe ?</DialogTitle>
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
