import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { OBJECTIVE_ICONS } from "../constants/objectiveIcons";
import { OBJECTIVE_STATUS_LABELS, OBJECTIVE_STATUS_COLORS } from "../constants/objectiveStatuses";
import { formatTargetDate } from "../utils/dateFormatter";
import CompactFinanceCard from "./CompactFinanceCard";
import { PILOTAGE_PROGRESS_SX } from "./PilotagePageLayout";

export function ObjectiveCard({ objective, onEdit, onDelete, enableDoubleClickEdit = false }) {
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);

  const percentage = Math.min((objective.currentAmount / objective.targetAmount) * 100, 100);
  const icon = OBJECTIVE_ICONS[objective.icon] || "⭐";
  const statusLabel = OBJECTIVE_STATUS_LABELS[objective.status] || objective.status;
  const statusColor = OBJECTIVE_STATUS_COLORS[objective.status] || "#9E9E9E";

  const handleConfirmDelete = async () => {
    await onDelete(objective.id);
    setDeleteConfirm(false);
  };

  const handleEditClick = () => {
    onEdit(objective);
  };

  const handleOpenMenu = (event) => {
    setActionMenuAnchor(event.currentTarget);
  };

  const handleCloseMenu = () => {
    setActionMenuAnchor(null);
  };

  const targetLabel = objective.targetDate ? formatTargetDate(objective.targetDate) : "Aucune date limite";

  return (
    <>
      <Box sx={{ borderLeft: `4px solid ${objective.color}`, borderRadius: 2 }}>
        <CompactFinanceCard
          title={objective.name || "Sans nom"}
          subtitle={`${statusLabel} • ${targetLabel}`}
          amount={`${Number(objective.currentAmount || 0).toFixed(2)} €`}
          amountColor={statusColor}
          categoryIcon={icon}
          onEditClick={handleEditClick}
          onMenuClick={handleOpenMenu}
          enableDoubleClickEdit={enableDoubleClickEdit}
        />

        <Box sx={{ px: 1.25, pt: 0, pb: 0.5 }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 0.75, mb: 0.9 }}>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
              Actuel : {Number(objective.currentAmount || 0).toFixed(2)} €
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
              Objectif : {Number(objective.targetAmount || 0).toFixed(2)} €
            </Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
              Progression
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: statusColor, fontSize: { xs: "0.74rem", sm: "0.8rem" } }}>
              {Math.round(percentage)}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={percentage}
            aria-label={`Progression de l'objectif ${objective.name || "Sans nom"}`}
            sx={{ ...PILOTAGE_PROGRESS_SX, mb: 0.75 }}
          />

          <Typography variant="caption" color="text.secondary">
            Date cible : {targetLabel}
          </Typography>
        </Box>
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
            handleEditClick();
            handleCloseMenu();
          }}
        >
          Modifier
        </MenuItem>
        <MenuItem
          onClick={() => {
            setDeleteConfirm(true);
            handleCloseMenu();
          }}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm} onClose={() => setDeleteConfirm(false)}>
        <DialogTitle>Confirmer la suppression</DialogTitle>
        <DialogContent>
          <Typography>
            Êtes-vous sûr de vouloir supprimer l'objectif "{objective.name}" ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(false)}>Annuler</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
