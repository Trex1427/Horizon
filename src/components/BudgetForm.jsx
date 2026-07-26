import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  MenuItem,
  Stack,
  TextField,
} from "@mui/material";
import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";
import EntityFormDialog from "./EntityFormDialog";
import { getBudgetSubcategoryOptions, resetIncompatibleBudgetSubcategory } from "../utils/budgetFormUtils";

const defaultForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  subcategoryId: "",
  subcategoryName: "",
  accountId: "",
  amount: "",
  startDate: "",
  endDate: "",
};

export function BudgetForm({
  open,
  onClose,
  onSubmit,
  initialBudget,
  isLoading,
  categories = [],
  subcategories = [],
}) {
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
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [categories]);
  const subcategoryOptions = useMemo(
    () => getBudgetSubcategoryOptions(subcategories, formData.categoryId),
    [formData.categoryId, subcategories]
  );

  useEffect(() => {
    if (initialBudget) {
      const selectedCategory = categories.find((category) => category.id === initialBudget.categoryId);
      const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === initialBudget.subcategoryId);
      setFormData({
        name: initialBudget.name || "",
        categoryId: initialBudget.categoryId || "",
        categoryName: getSafeCategoryLabel(initialBudget.categoryName || selectedCategory?.name, ""),
        subcategoryId: initialBudget.subcategoryId || "",
        subcategoryName: initialBudget.subcategoryName || selectedSubcategory?.name || "",
        accountId: initialBudget.accountId || "",
        amount: String(initialBudget.amount ?? ""),
        startDate: initialBudget.startDate || "",
        endDate: initialBudget.endDate || "",
      });
    } else {
      setFormData({ ...defaultForm });
    }
    setErrors({});
  }, [categories, initialBudget, open, subcategories]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (errors[name] || errors.submit) {
      setErrors((previous) => ({ ...previous, [name]: null, submit: null }));
    }
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.name.trim()) nextErrors.name = "Le nom est requis";
    if (!formData.categoryId) nextErrors.categoryId = "Une catégorie est requise";
    if (!formData.amount || Number.isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
      nextErrors.amount = "Un montant valide est requis";
    }
    if (!formData.startDate) nextErrors.startDate = "La date de début est requise";

    if (formData.subcategoryId) {
      const selectedSubcategory = subcategoryOptions.find((subcategory) => subcategory.id === formData.subcategoryId);
      if (!selectedSubcategory) nextErrors.subcategoryId = "Cette sous-catégorie n’est pas compatible avec la catégorie sélectionnée";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submissionInFlightRef.current || isLoading || !validate()) return;

    const selectedCategory = categoryOptions.find((category) => category.id === formData.categoryId);
    const selectedSubcategory = subcategoryOptions.find((subcategory) => subcategory.id === formData.subcategoryId);
    const payload = {
      name: formData.name.trim(),
      categoryId: formData.categoryId || "",
      categoryName: getSafeCategoryLabel(selectedCategory?.name || formData.categoryName || initialBudget?.categoryName, ""),
      subcategoryId: selectedSubcategory?.id || null,
      subcategoryName: selectedSubcategory?.name || null,
      accountId: formData.accountId || null,
      amount: Number(formData.amount),
      startDate: formData.startDate || null,
      endDate: formData.endDate || null,
      typeBudget: "depense",
      periodType: initialBudget?.periodType || "mensuel",
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
      } else {
        setErrors((previous) => ({ ...previous, submit: result.error || "Impossible d’enregistrer ce budget" }));
      }
    } catch (error) {
      setErrors((previous) => ({ ...previous, submit: error?.message || "Impossible d’enregistrer ce budget" }));
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
        {errors.submit && <Alert severity="error">{errors.submit}</Alert>}
        <TextField label="Nom" name="name" value={formData.name} onChange={handleChange} fullWidth error={Boolean(errors.name)} helperText={errors.name} />
        <TextField
          label="Catégorie"
          name="categoryId"
          select
          value={formData.categoryId}
          onChange={(event) => {
            const nextCategoryId = event.target.value;
            const selectedCategory = categories.find((category) => category.id === nextCategoryId);
            setFormData((previous) => ({
              ...resetIncompatibleBudgetSubcategory(previous, nextCategoryId, subcategories),
              categoryName: selectedCategory?.name || "",
            }));
            setErrors((previous) => ({ ...previous, categoryId: null, subcategoryId: null, submit: null }));
          }}
          fullWidth
          error={Boolean(errors.categoryId)}
          helperText={errors.categoryId}
        >
          {categoryOptions.map((category) => (
            <MenuItem key={category.id} value={category.id}>{getSafeCategoryLabel(category.name)}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Sous-catégorie (optionnelle)"
          name="subcategoryId"
          select
          value={formData.subcategoryId}
          onChange={(event) => {
            const selectedSubcategory = subcategoryOptions.find((subcategory) => subcategory.id === event.target.value);
            setFormData((previous) => ({
              ...previous,
              subcategoryId: selectedSubcategory?.id || "",
              subcategoryName: selectedSubcategory?.name || "",
            }));
            setErrors((previous) => ({ ...previous, subcategoryId: null, submit: null }));
          }}
          disabled={!formData.categoryId}
          fullWidth
          error={Boolean(errors.subcategoryId)}
          helperText={errors.subcategoryId || (!formData.categoryId ? "Sélectionnez d’abord une catégorie" : "Laisser vide pour un budget global de catégorie")}
        >
          <MenuItem value="">Aucune — budget de catégorie</MenuItem>
          {subcategoryOptions.map((subcategory) => (
            <MenuItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</MenuItem>
          ))}
        </TextField>
        <TextField label="Montant prévu (€)" name="amount" type="number" value={formData.amount} onChange={handleChange} fullWidth error={Boolean(errors.amount)} helperText={errors.amount} inputProps={{ step: "0.01", min: "0" }} />
        <TextField label="Date de début" name="startDate" type="date" value={formData.startDate} onChange={handleChange} fullWidth error={Boolean(errors.startDate)} helperText={errors.startDate} InputLabelProps={{ shrink: true }} />
        <TextField label="Date de fin (optionnelle)" name="endDate" type="date" value={formData.endDate} onChange={handleChange} fullWidth InputLabelProps={{ shrink: true }} />
      </Stack>
    </EntityFormDialog>
  );
}
