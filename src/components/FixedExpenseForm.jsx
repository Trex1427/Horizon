import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Delete from "@mui/icons-material/Delete";
import AccountSelector from "./AccountSelector";
import EntityFormDialog from "./EntityFormDialog";
import {
  buildFixedExpensePayload,
  getExpenseCategoryOptions,
  validateFixedExpenseForm,
} from "../services/recurringAndFixedFormPayloads";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import {
  getFixedExpenseSubcategoryOptions,
  resetIncompatibleFixedExpenseSubcategory,
} from "../utils/fixedExpenseFormUtils";

const defaultForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  category: "",
  subcategoryId: "",
  subcategoryName: "",
  accountId: "",
  frequency: "monthly",
  initialAmount: "",
  startDate: "",
  endDate: "",
  description: "",
};

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

const LEGACY_CATEGORY_OPTIONS = [
  "Logement",
  "Transport",
  "Abonnements",
  "Santé",
  "Éducation",
  "Autre",
];

export function FixedExpenseForm({
  open,
  onClose,
  onSubmit,
  initialExpense,
  isLoading,
  accounts = [],
  categories = [],
  subcategories = [],
}) {
  const [formData, setFormData] = useState(defaultForm);
  const [variations, setVariations] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const expenseCategories = useMemo(() => getExpenseCategoryOptions(categories), [categories]);
  const subcategoryOptions = useMemo(
    () => getFixedExpenseSubcategoryOptions(subcategories, formData.categoryId),
    [formData.categoryId, subcategories]
  );

  // The dialog intentionally rehydrates its local draft whenever the edited entity changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialExpense) {
      const initialCategoryName = initialExpense.categoryName || initialExpense.category || "";
      const selectedCategory =
        expenseCategories.find((category) => category.id === initialExpense.categoryId) ||
        expenseCategories.find(
          (category) => normalizeCategoryName(category.name) === normalizeCategoryName(initialCategoryName)
        );

      setFormData({
        name: initialExpense.name || "",
        categoryId: initialExpense.categoryId || selectedCategory?.id || "",
        categoryName: initialExpense.categoryName || selectedCategory?.name || initialCategoryName,
        category: initialExpense.category || selectedCategory?.name || initialCategoryName,
        subcategoryId: initialExpense.subcategoryId || "",
        subcategoryName: initialExpense.subcategoryName || "",
        accountId: initialExpense.accountId || "",
        frequency: initialExpense.frequency || "monthly",
        initialAmount: String(initialExpense.initialAmount ?? ""),
        startDate: initialExpense.startDate || "",
        endDate: initialExpense.endDate || "",
        description: initialExpense.description || "",
      });
      setVariations(Array.isArray(initialExpense.variations) ? initialExpense.variations : []);
    } else {
      const fallbackCategory = expenseCategories[0];
      setFormData({
        ...defaultForm,
        categoryId: fallbackCategory?.id || "",
        categoryName: fallbackCategory?.name || "",
        category: fallbackCategory?.name || "",
      });
      setVariations([]);
    }
    setErrors({});
  }, [initialExpense, open, expenseCategories]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleVariationChange = (index, event) => {
    const { name, value } = event.target;
    setVariations((prev) => prev.map((variation, variationIndex) => (
      variationIndex === index ? { ...variation, [name]: value } : variation
    )));
  };

  const addVariation = () => {
    setVariations((prev) => [...prev, { effectiveDate: "", amount: "", note: "" }]);
  };

  const removeVariation = (index) => {
    setVariations((prev) => prev.filter((_, variationIndex) => variationIndex !== index));
  };

  const validate = () => {
    const nextErrors = validateFixedExpenseForm({ ...formData, variations });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = buildFixedExpensePayload({ ...formData, variations }, expenseCategories, initialExpense, subcategories);

    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: null }));
    let result;
    try {
      result = await onSubmit(payload);
    } catch (error) {
      result = { success: false, error: error?.message || "Enregistrement impossible" };
    } finally {
      setSubmitting(false);
    }

    if (result?.success) {
      setFormData(defaultForm);
      setVariations([]);
      setErrors({});
      onClose();
    } else {
      setErrors((prev) => ({ ...prev, submit: result?.error || "Enregistrement impossible" }));
    }
  };

  return (
    <EntityFormDialog
      open={open}
      title={initialExpense ? "Modifier un frais fixe" : "Ajouter un frais fixe"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={isLoading || submitting}
      submitLabel={initialExpense ? "Enregistrer" : "Créer"}
      maxWidth="md"
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        {errors.submit && <Alert severity="error">{errors.submit}</Alert>}
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
          value={formData.categoryId || formData.categoryName || formData.category}
          onChange={(event) => {
            const selectedCategory = expenseCategories.find((category) => category.id === event.target.value);
            const selectedName = selectedCategory?.name || event.target.value;

            setFormData((prev) => ({
              ...resetIncompatibleFixedExpenseSubcategory(prev, selectedCategory?.id || "", subcategories),
              categoryName: selectedName,
              category: selectedName,
            }));

            if (errors.category) {
              setErrors((prev) => ({ ...prev, category: null }));
            }
          }}
          fullWidth
          error={Boolean(errors.category)}
          helperText={errors.category}
        >
          {expenseCategories.length > 0
            ? expenseCategories.map((category) => (
              <MenuItem key={category.id} value={category.id}>
                {getSafeCategoryLabel(category.name)}
              </MenuItem>
            ))
            : LEGACY_CATEGORY_OPTIONS.map((categoryName) => (
              <MenuItem key={categoryName} value={categoryName}>
                {categoryName}
              </MenuItem>
            ))}
        </TextField>

        <TextField
          label="Sous-catégorie (optionnelle)"
          name="subcategoryId"
          select
          value={formData.subcategoryId}
          onChange={(event) => {
            const selectedSubcategory = subcategoryOptions.find((subcategory) => subcategory.id === event.target.value);
            setFormData((prev) => ({
              ...prev,
              subcategoryId: selectedSubcategory?.id || "",
              subcategoryName: selectedSubcategory?.name || "",
            }));
            setErrors((prev) => ({ ...prev, subcategoryId: null, submit: null }));
          }}
          fullWidth
          disabled={!formData.categoryId}
          error={Boolean(errors.subcategoryId)}
          helperText={errors.subcategoryId || (!formData.categoryId ? "Sélectionnez d’abord une catégorie" : "Laisser vide pour un frais fixe de catégorie")}
        >
          <MenuItem value="">Aucune — frais fixe de catégorie</MenuItem>
          {subcategoryOptions.map((subcategory) => (
            <MenuItem key={subcategory.id} value={subcategory.id}>
              {subcategory.name}
            </MenuItem>
          ))}
        </TextField>
        <AccountSelector
          value={formData.accountId}
          onChange={handleChange}
          accounts={accounts}
          label="Compte associé"
        />

        <TextField
          label="Fréquence"
          name="frequency"
          select
          value={formData.frequency}
          onChange={handleChange}
          fullWidth
        >
          <MenuItem value="monthly">Mensuel</MenuItem>
          <MenuItem value="annual">Annuel</MenuItem>
        </TextField>

        <TextField
          label="Montant initial (€)"
          name="initialAmount"
          type="number"
          value={formData.initialAmount}
          onChange={handleChange}
          fullWidth
          error={Boolean(errors.initialAmount)}
          helperText={errors.initialAmount}
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

        <TextField
          label="Description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          fullWidth
          multiline
          minRows={2}
        />

        <Box>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle2">Variations de montant</Typography>
            <Button startIcon={<Add />} size="small" onClick={addVariation}>
              Ajouter
            </Button>
          </Box>

          {variations.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Aucune variation ajoutée pour le moment.
            </Typography>
          ) : (
            <Stack spacing={1.5}>
              {variations.map((variation, index) => (
                <Box key={`variation-${index}`} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                    <Typography variant="body2" fontWeight={600}>Variation {index + 1}</Typography>
                    <IconButton size="small" color="error" onClick={() => removeVariation(index)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                  <Stack spacing={1.5}>
                    <TextField
                      label="Date d’effet"
                      name="effectiveDate"
                      type="date"
                      value={variation.effectiveDate || ""}
                      onChange={(event) => handleVariationChange(index, event)}
                      fullWidth
                      InputLabelProps={{ shrink: true }}
                    />
                    <TextField
                      label="Montant"
                      name="amount"
                      type="number"
                      value={variation.amount || ""}
                      onChange={(event) => handleVariationChange(index, event)}
                      fullWidth
                      inputProps={{ step: "0.01", min: "0" }}
                    />
                    <TextField
                      label="Note"
                      name="note"
                      value={variation.note || ""}
                      onChange={(event) => handleVariationChange(index, event)}
                      fullWidth
                    />
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </Box>
      </Stack>
    </EntityFormDialog>
  );
}
