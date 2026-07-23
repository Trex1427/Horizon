import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import Delete from "@mui/icons-material/Delete";
import Edit from "@mui/icons-material/Edit";
import MoreVert from "@mui/icons-material/MoreVert";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

export function CategoryCard({ category, onEdit, onDelete, enableDoubleClickEdit = false }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);

  const handleDelete = async () => {
    await onDelete(category.id);
    setDeleteConfirmOpen(false);
    setMenuAnchorEl(null);
  };

  const handleEdit = () => {
    setMenuAnchorEl(null);
    onEdit(category);
  };

  const typeLabel = category.type === "revenu" ? "Revenu" : "Dépense";
  const categoryLabel = getSafeCategoryLabel(category.name, "Catégorie");
  const active = category.isActive !== false;

  return (
    <>
      <Card
        onDoubleClick={() => {
          if (enableDoubleClickEdit) handleEdit();
        }}
        sx={{
          mb: 0.75,
          cursor: enableDoubleClickEdit ? "pointer" : "default",
          border: "1px solid",
          borderColor: "rgba(23, 42, 47, 0.12)",
          borderRadius: 2,
          boxShadow: "0 10px 22px rgba(20, 41, 43, 0.06)",
          opacity: active ? 1 : 0.72,
          transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
          "&:hover": {
            borderColor: "rgba(15, 95, 143, 0.24)",
            boxShadow: "0 14px 28px rgba(20, 41, 43, 0.09)",
            transform: "translateY(-1px)",
          },
        }}
      >
        <CardContent
          sx={{
            py: 0.9,
            px: 1.25,
            "&:last-child": { pb: 0.9 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Box
                  sx={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: category.color || "#2196F3",
                    flexShrink: 0,
                  }}
                />
                <Typography fontWeight={900} noWrap sx={{ fontSize: { xs: "0.95rem", sm: "1rem" }, lineHeight: 1.2 }}>
                  {categoryLabel}
                </Typography>
              </Box>

              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                <Chip size="small" label={typeLabel} sx={{ height: 22, fontWeight: 800 }} />
                <Chip size="small" label={active ? "Actif" : "Inactif"} sx={{ height: 22, fontWeight: 800 }} />
                {category.displayOrder !== undefined && (
                  <Typography variant="caption" color="text.secondary">
                    Ordre {category.displayOrder}
                  </Typography>
                )}
              </Stack>
            </Box>

            <IconButton
              size="small"
              aria-label="Actions categorie"
              onClick={(event) => {
                event.stopPropagation();
                setMenuAnchorEl(event.currentTarget);
              }}
              onDoubleClick={(event) => event.stopPropagation()}
              sx={{ p: 0.35 }}
            >
              <MoreVert fontSize="small" />
            </IconButton>
          </Box>
        </CardContent>

        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={() => setMenuAnchorEl(null)}>
          <MenuItem onClick={handleEdit}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Modifier
          </MenuItem>
          <MenuItem
            onClick={() => {
              setMenuAnchorEl(null);
              setDeleteConfirmOpen(true);
            }}
            sx={{ color: "error.main" }}
          >
            <Delete fontSize="small" sx={{ mr: 1 }} />
            Supprimer
          </MenuItem>
        </Menu>
      </Card>

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Désactiver cette catégorie ?</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action la marquera comme inactive sans la supprimer définitivement.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Désactiver
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
