import { useState, useEffect } from "react";
import {
  TextField,
  Stack,
  MenuItem,
  Box,
  Typography,
} from "@mui/material";
import { OBJECTIVE_ICON_OPTIONS } from "../constants/objectiveIcons";
import { dateToInputFormat } from "../utils/dateFormatter";
import EntityFormDialog from "./EntityFormDialog";

const COLORS = [
  { value: "#FF5722", label: "Orange" },
  { value: "#F44336", label: "Rouge" },
  { value: "#E91E63", label: "Rose" },
  { value: "#9C27B0", label: "Violet" },
  { value: "#673AB7", label: "Indigo" },
  { value: "#3F51B5", label: "Bleu" },
  { value: "#2196F3", label: "Bleu clair" },
  { value: "#00BCD4", label: "Cyan" },
  { value: "#009688", label: "Teal" },
  { value: "#4CAF50", label: "Vert" },
  { value: "#8BC34A", label: "Vert clair" },
  { value: "#CDDC39", label: "Jaune" },
  { value: "#FFC107", label: "Ambre" },
];

export function ObjectiveForm({ open, onClose, onSubmit, isLoading, initialObjective }) {
  const [formData, setFormData] = useState({
    name: "",
    icon: "star",
    color: "#2196F3",
    targetAmount: "",
    currentAmount: "0",
    targetDate: "",
  });

  // Initialiser le formulaire avec les données si on est en édition
  useEffect(() => {
    if (initialObjective) {
      // Mode édition
      setFormData({
        name: initialObjective.name,
        icon: initialObjective.icon,
        color: initialObjective.color,
        targetAmount: String(initialObjective.targetAmount),
        currentAmount: String(initialObjective.currentAmount),
        targetDate: dateToInputFormat(initialObjective.targetDate),
      });
    } else {
      // Mode création
      setFormData({
        name: "",
        icon: "star",
        color: "#2196F3",
        targetAmount: "",
        currentAmount: "0",
        targetDate: "",
      });
    }
    setErrors({});
  }, [initialObjective, open]);

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = "Le nom est requis";
    }

    const targetAmount = parseFloat(formData.targetAmount);
    if (!formData.targetAmount || isNaN(targetAmount) || targetAmount <= 0) {
      newErrors.targetAmount = "Un montant cible valide est requis";
    }

    const currentAmount = parseFloat(formData.currentAmount);
    if (isNaN(currentAmount) || currentAmount < 0) {
      newErrors.currentAmount = "Le montant actuel doit être positif";
    }

    if (currentAmount > targetAmount) {
      newErrors.currentAmount = "Le montant actuel ne peut pas dépasser le montant cible";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const payload = {
      name: formData.name,
      icon: formData.icon,
      color: formData.color,
      targetAmount: parseFloat(formData.targetAmount),
      currentAmount: parseFloat(formData.currentAmount),
      targetDate: formData.targetDate ? new Date(formData.targetDate) : null,
    };

    const result = await onSubmit(payload);

    if (result.success) {
      setFormData({
        name: "",
        icon: "star",
        color: "#2196F3",
        targetAmount: "",
        currentAmount: "0",
        targetDate: "",
      });
      setErrors({});
      onClose();
    }
  };

  const isEditMode = !!initialObjective;
  const dialogTitle = isEditMode ? "Modifier l'objectif" : "Créer un nouvel objectif";
  const submitButtonLabel = isEditMode ? "Enregistrer" : "Créer";

  return (
    <EntityFormDialog
      open={open}
      title={dialogTitle}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={isLoading}
      submitLabel={submitButtonLabel}
      maxWidth="sm"
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nom"
            name="name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            error={!!errors.name}
            helperText={errors.name}
            placeholder="ex: Voiture"
          />

          <TextField
            select
            label="Icône"
            name="icon"
            value={formData.icon}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            {OBJECTIVE_ICON_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Couleur
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))",
                gap: 1,
              }}
            >
              {COLORS.map((colorOption) => (
                <Box
                  key={colorOption.value}
                  onClick={() => setFormData((prev) => ({ ...prev, color: colorOption.value }))}
                  sx={{
                    width: 40,
                    height: 40,
                    backgroundColor: colorOption.value,
                    borderRadius: 1,
                    cursor: "pointer",
                    border: formData.color === colorOption.value ? "3px solid #000" : "2px solid #ccc",
                    transition: "all 0.2s",
                    "&:hover": {
                      transform: "scale(1.1)",
                    },
                  }}
                  title={colorOption.label}
                />
              ))}
            </Box>
          </Box>

          <TextField
            label="Montant cible (€)"
            name="targetAmount"
            type="number"
            value={formData.targetAmount}
            onChange={handleChange}
            fullWidth
            error={!!errors.targetAmount}
            helperText={errors.targetAmount}
            inputProps={{ step: "0.01", min: "0" }}
            placeholder="25000"
          />

          <TextField
            label="Montant actuel (€)"
            name="currentAmount"
            type="number"
            value={formData.currentAmount}
            onChange={handleChange}
            fullWidth
            error={!!errors.currentAmount}
            helperText={errors.currentAmount}
            inputProps={{ step: "0.01", min: "0" }}
            placeholder="0"
          />

          <TextField
            label="Date cible (optionnel)"
            name="targetDate"
            type="date"
            value={formData.targetDate}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
      </Stack>
    </EntityFormDialog>
  );
}
