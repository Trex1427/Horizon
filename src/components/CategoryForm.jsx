import { useEffect, useState } from "react";
import {
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getSafeIconLabel } from "../utils/displayTextUtils";
import EntityFormDialog from "./EntityFormDialog";

const COLORS = [
  { value: "#FF9800", label: "Orange" },
  { value: "#3F51B5", label: "Bleu" },
  { value: "#009688", label: "Turquoise" },
  { value: "#E91E63", label: "Rose" },
  { value: "#9C27B0", label: "Violet" },
  { value: "#4CAF50", label: "Vert" },
  { value: "#607D8B", label: "Gris" },
  { value: "#795548", label: "Marron" },
];

const defaultForm = {
  name: "",
  type: "depense",
  icon: "",
  color: "#2196F3",
  displayOrder: "0",
};

export function CategoryForm({ open, onClose, onSubmit, isLoading, initialCategory, initialDraft = null, lockedType = "", errorMessage = "" }) {
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (initialCategory) {
      setFormData({
        name: initialCategory.name || "",
        type: initialCategory.type || "depense",
        icon: getSafeIconLabel(initialCategory.icon) === "Icône" ? "" : initialCategory.icon,
        color: initialCategory.color || "#2196F3",
        displayOrder: String(initialCategory.displayOrder ?? 0),
      });
    } else if (initialDraft) {
      setFormData({
        ...defaultForm,
        ...initialDraft,
        name: initialDraft.name || "",
        type: initialDraft.type || lockedType || "depense",
        icon: initialDraft.icon || "",
        color: initialDraft.color || "#2196F3",
        displayOrder: String(initialDraft.displayOrder ?? 0),
      });
    } else {
      setFormData({
        ...defaultForm,
        type: lockedType || defaultForm.type,
      });
    }
    setErrors({});
  }, [initialCategory, initialDraft, lockedType, open]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const validate = () => {
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = "Le nom est requis";
    }

    if (!formData.type) {
      nextErrors.type = "Le type est requis";
    }

    const displayOrder = Number(formData.displayOrder);
    if (Number.isNaN(displayOrder)) {
      nextErrors.displayOrder = "L’ordre doit être un nombre";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      name: formData.name.trim(),
      type: formData.type,
      icon: formData.icon.trim() || "◦",
      color: formData.color,
      displayOrder: Number(formData.displayOrder || 0),
    };

    const result = await onSubmit(payload);
    if (result.success) {
      setFormData(defaultForm);
      setErrors({});
      onClose();
    }
  };

  return (
    <EntityFormDialog
      open={open}
      title={initialCategory ? "Modifier la catégorie" : "Créer une catégorie"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={isLoading}
      submitLabel={initialCategory ? "Enregistrer" : "Créer"}
      maxWidth="sm"
      errorMessage={errorMessage}
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nom"
            name="name"
            value={formData.name}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.name)}
            helperText={errors.name}
          />

          <TextField
            label="Type"
            name="type"
            select
            value={formData.type}
            onChange={handleChange}
            fullWidth
            disabled={Boolean(lockedType)}
            error={Boolean(errors.type)}
            helperText={errors.type}
          >
            <MenuItem value="depense">Dépense</MenuItem>
            <MenuItem value="revenu">Revenu</MenuItem>
          </TextField>

          <TextField
            label="Icône (emoji)"
            name="icon"
            value={formData.icon}
            onChange={handleChange}
            fullWidth
            helperText="Exemple: 🍽️, 🚗, 🏠. Les codes techniques ne sont pas affiches."
          />

          <TextField
            label="Ordre d’affichage"
            name="displayOrder"
            type="number"
            value={formData.displayOrder}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.displayOrder)}
            helperText={errors.displayOrder}
          />

          <div>
            <Typography variant="body2" sx={{ mb: 1 }}>
              Couleur
            </Typography>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
              {COLORS.map((colorOption) => (
                <button
                  key={colorOption.value}
                  onClick={() => setFormData((prev) => ({ ...prev, color: colorOption.value }))}
                  type="button"
                  style={{
                    minWidth: 0,
                    width: 40,
                    height: 40,
                    backgroundColor: colorOption.value,
                    border: formData.color === colorOption.value ? "2px solid #000" : "2px solid transparent",
                    borderRadius: 4,
                    padding: 0,
                  }}
                />
              ))}
            </Stack>
          </div>
      </Stack>
    </EntityFormDialog>
  );
}
