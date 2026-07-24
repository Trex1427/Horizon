import { useEffect, useMemo, useRef, useState } from "react";
import {
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";
import EntityFormDialog from "./EntityFormDialog";

const defaultForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  accountId: "",
  amount: "",
  startDate: "",
  endDate: "",
};

export function BudgetForm({ open, onClose, onSubmit, initialBudget, isLoading, categories = [] }) {
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionInFlightRef = useRef(false);
  const categoryOptions = useMemo(() => {
    const seen = new Set();

    return categories
      .filter((category) => normalizeTransactionType(category.type) === "depense")
      .filter((category) => !isTechnicalCategoryDisplayValue(category.name))
      .filter((category) => {
        const key = String(category.name || "").trim().toLowerCase();
        if (!key || seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }, [categories]);

  useEffect(() => {
    if (initialBudget) {
      const selectedCategory = categories.find((category) => category.id === initialBudget.categoryId);
      setFormData({
        name: initialBudget.name || "",
        categoryId: initialBudget.categoryId || "",
        categoryName: getSafeCategoryLabel(initialBudget.categoryName || selectedCategory?.name, ""),
        accountId: initialBudget.accountId || "",
        amount: String(initialBudget.amount ?? ""),
        startDate: initialBudget.startDate || "",
        endDate: initialBudget.endDate || "",
      });
    } else {
      setFormData({ ...defaultForm });
    }
    setErrors({});
  }, [categories, initialBudget, open]);

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

    if (!formData.categoryId) {
      nextErrors.categoryId = "Une catégorie est requise";
    }

    if (!formData.amount || Number.isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      nextErrors.amount = "Un montant valide est requis";
    }

    if (!formData.startDate) {
      nextErrors.startDate = "La date de début est requise";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submissionInFlightRef.current || isLoading || !validate()) return;

    const selectedCategory = categoryOptions.find((category) => category.id === formData.categoryId);

    const payload = {
      name: formData.name.trim(),
      categoryId: formData.categoryId || "",
      categoryName: getSafeCategoryLabel(selectedCategory?.name || formData.categoryName || initialBudget?.categoryName, ""),
      accountId: formData.accountId || null,
      amount: Number(formData.amount),
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      typeBudget: "depense",
      periodType: "mensuel",
      isActive: initialBudget?.isActive ?? true,
    };

    submissionInFlightRef.current = true;
    setIsSubmitting(true);

    try {
      const result = await onSubmit(payload);
      if (result.success) {
        setFormData({ ...defaultForm });
        setErrors({});
        onClose();
      }
    } finally {
      submissionInFlightRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <EntityFormDialog
      open={open}
      title={initialBudget ? "Modifier un budget" : "Ajouter un budget"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={isLoading || isSubmitting}
      submitLabel={initialBudget ? "Enregistrer" : "Créer"}
      maxWidth="md"
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
            label="Catégorie"
            name="categoryId"
            select
            value={formData.categoryId}
            onChange={(event) => {
              const selectedCategory = categories.find((category) => category.id === event.target.value);
              setFormData((prev) => ({
                ...prev,
                categoryId: event.target.value,
                categoryName: selectedCategory?.name || prev.categoryName,
              }));
            }}
            fullWidth
            error={Boolean(errors.categoryId)}
            helperText={errors.categoryId}
          >
            {categoryOptions
              .map((category) => (
                <MenuItem key={category.id} value={category.id}>
                  {getSafeCategoryLabel(category.name)}
                </MenuItem>
              ))}
          </TextField>

          <TextField
            label="Montant prévu (€)"
            name="amount"
            type="number"
            value={formData.amount}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.amount)}
            helperText={errors.amount}
            inputProps={{ step: "0.01", min: "0" }}
          />

          <TextField
            label="Date de début"
            name="startDate"
            type="date"
            value={formData.startDate}
            onChange={handleChange}
            fullWidth
            error={Boolean(errors.startDate)}
            helperText={errors.startDate}
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Date de fin (optionnelle)"
            name="endDate"
            type="date"
            value={formData.endDate}
            onChange={handleChange}
            fullWidth
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
    </EntityFormDialog>
  );
}
