import { useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import CompactFinanceCard from "./CompactFinanceCard";
import { formatTargetDate } from "../utils/dateFormatter";
import { isOpportunityRealized } from "../services/opportunityTransactionLink";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function isOpportunityForecastIncluded(opportunity) {
  if (!opportunity || opportunity.isActive === false || opportunity.isDeleted === true) {
    return false;
  }

  const status = String(opportunity?.status || "").trim().toLowerCase();
  if (status === "realise" || status === "réalisé" || status === "abandonne" || status === "abandonné") {
    return false;
  }

  const date = new Date(opportunity.estimatedDate || opportunity.date || "");
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date > today && Number(opportunity.estimatedAmount ?? opportunity.amount) > 0;
}

function getForecastInclusionLabel(opportunity) {
  if (isOpportunityForecastIncluded(opportunity)) {
    return "Incluse dans la prévision";
  }

  if (opportunity?.isActive === false) return "Non incluse - opportunité inactive";
  if (opportunity?.isDeleted === true) return "Non incluse - opportunité supprimée";

  const status = String(opportunity?.status || "").trim().toLowerCase();
  if (status === "realise" || status === "réalisé") return "Non incluse - opportunité réalisée";
  if (status === "abandonne" || status === "abandonné") return "Non incluse - opportunité abandonnée";

  const date = new Date(opportunity?.estimatedDate || opportunity?.date || "");
  if (Number.isNaN(date.getTime())) return "Non incluse - date prévisionnelle absente";

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date <= today) return "Non incluse - opportunité passée";

  return "Non incluse - montant prévisionnel absent";
}

export default function OpportunityCard({
  opportunity,
  accounts = [],
  projects = [],
  onEdit,
  onToggleActive,
  onDelete,
  onCreateTransaction,
  onOpenTransaction,
  linkedTransaction = null,
  enableDoubleClickEdit = false,
}) {
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  const accountName = useMemo(
    () => accounts.find((account) => account.id === opportunity.accountId)?.name || "Compte non défini",
    [accounts, opportunity.accountId]
  );
  const projectName = useMemo(
    () => opportunity.projectName || projects.find((project) => project.id === opportunity.projectId)?.name || "",
    [opportunity.projectId, opportunity.projectName, projects]
  );

  const activeLabel = opportunity.isActive === false ? "Inactive" : "Active";
  const metaPrimary = `${opportunity.status || "À étudier"} - ${activeLabel}`;
  const metaSecondary = `${formatTargetDate(opportunity.estimatedDate)} - ${accountName}`;
  const realized = isOpportunityRealized(opportunity);
  const linkedTransactionId = String(opportunity.realizedTransactionId || "").trim();
  const linkedTransactionMissing = realized && linkedTransactionId && !linkedTransaction;
  const transactionState = realized
    ? linkedTransaction
      ? "Transaction créée"
      : linkedTransactionMissing
        ? "Transaction liée introuvable"
        : "Transaction à créer"
    : "";
  const forecastInclusionLabel = getForecastInclusionLabel(opportunity);
  const thirdPartyName = opportunity.thirdPartyName || "";
  const activityName = opportunity.activityName || "";
  const statusLabel = opportunity.status || "À étudier";
  const details = [forecastInclusionLabel, opportunity.categoryName || opportunity.category, thirdPartyName, activityName, projectName, opportunity.comment, transactionState].filter(Boolean).join(" - ");

  async function handleDelete() {
    await onDelete(opportunity.id);
    setDeleteConfirmOpen(false);
  }

  return (
    <>
      <CompactFinanceCard
        title={opportunity.name || "Opportunite"}
        metaPrimary={metaPrimary}
        metaSecondary={metaSecondary}
        details={details}
        amount={formatCurrency(opportunity.estimatedAmount)}
        amountColor={opportunity.isActive === false ? "text.secondary" : "success.main"}
        categoryIcon="*"
        transactionKind="futureIncome"
        badges={[
          { label: "Statut", value: statusLabel },
          { label: "Prévision", value: forecastInclusionLabel },
        ]}
        onEditClick={() => onEdit(opportunity)}
        onMenuClick={(event) => setActionMenuAnchor(event.currentTarget)}
        enableDoubleClickEdit={enableDoubleClickEdit}
      />

      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            onEdit(opportunity);
            setActionMenuAnchor(null);
          }}
        >
          Modifier
        </MenuItem>
        <MenuItem
          onClick={() => {
            onToggleActive(opportunity.id, opportunity.isActive === false);
            setActionMenuAnchor(null);
          }}
        >
          {opportunity.isActive === false ? "Activer" : "Désactiver"}
        </MenuItem>
        {realized && linkedTransaction && (
          <MenuItem
            onClick={() => {
              onOpenTransaction?.(linkedTransaction);
              setActionMenuAnchor(null);
            }}
          >
            Ouvrir la transaction
          </MenuItem>
        )}
        {realized && !linkedTransaction && (
          <MenuItem
            onClick={() => {
              onCreateTransaction?.(opportunity);
              setActionMenuAnchor(null);
            }}
          >
            Créer la transaction
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setDeleteConfirmOpen(true);
            setActionMenuAnchor(null);
          }}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Supprimer cette opportunité ?</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action masque l'opportunité sans créer de transaction.
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
