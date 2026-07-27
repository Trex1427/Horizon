/* eslint-disable react-hooks/set-state-in-effect -- dialog state is reset from the selected Firestore entity */
import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  buildRecurringIncomePayload,
  getIncomeCategoryOptions,
  validateRecurringIncomeForm,
} from "../services/recurringAndFixedFormPayloads";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { getRecurringIncomeInitialAmount } from "../utils/recurringIncomeAmount";

const defaultForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  category: "",
  accountId: "",
  frequency: "mensuel",
  initialAmount: "",
  startDate: "",
  endDate: "",
};

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

const LEGACY_CATEGORY_OPTIONS = [
  "Salaire",
  "Freelance",
  "Remboursements",
  "Investissements",
  "Autre",
];

export function RecurringIncomeForm({
  open,
  onClose,
  onSubmit,
  initialIncome,
  isLoading,
  accounts = [],
  categories = [],
}) {
  const [formData, setFormData] = useState(defaultForm);
  const [variations, setVariations] = useState([]);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const submittingRef = useRef(false);

  const incomeCategories = useMemo(() => getIncomeCategoryOptions(categories), [categories]);

  useEffect(() => {
    if (initialIncome) {
      const initialCategoryName = initialIncome.categoryName || initialIncome.category || "";
      const selectedCategory =
        incomeCategories.find((category) => category.id === initialIncome.categoryId) ||
        incomeCategories.find(
          (category) => normalizeCategoryName(category.name) === normalizeCategoryName(initialCategoryName)
        );

      setFormData({
        name: initialIncome.name || "",
        categoryId: initialIncome.categoryId || selectedCategory?.id || "",
        categoryName: initialIncome.categoryName || selectedCategory?.name || initialCategoryName,
        category: initialIncome.category || selectedCategory?.name || initialCategoryName,
        accountId: initialIncome.accountId || "",
        frequency: initialIncome.frequency || "mensuel",
        initialAmount: String(getRecurringIncomeInitialAmount(initialIncome)),
        startDate: initialIncome.startDate || "",
        endDate: initialIncome.endDate || "",
      });
      setVariations(Array.isArray(initialIncome.variations) ? initialIncome.variations : []);
    } else {
      const fallbackCategory = incomeCategories[0];
      setFormData({
        ...defaultForm,
        categoryId: fallbackCategory?.id || "",
        categoryName: fallbackCategory?.name || "",
        category: fallbackCategory?.name || "",
      });
      setVariations([]);
    }
    setErrors({});
    setSubmitError("");
  }, [initialIncome, open, incomeCategories]);

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
    const nextErrors = validateRecurringIncomeForm({ ...formData, variations });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (submittingRef.current || isLoading || !validate()) return;

    const payload = buildRecurringIncomePayload({ ...formData, variations }, incomeCategories, initialIncome);
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");

    try {
      const result = await onSubmit(payload);
      if (result?.success) {
        setFormData({ ...defaultForm });
        setVariations([]);
        setErrors({});
        onClose();
        return;
      }
      setSubmitError(result?.error || "Le revenu récurrent n’a pas pu être enregistré.");
    } catch (error) {
      setSubmitError(error?.message || "Le revenu récurrent n’a pas pu être enregistré.");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <EntityFormDialog
      open={open}
      title={initialIncome ? "Modifier un revenu récurrent" : "Ajouter un revenu récurrent"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={submitting || isLoading}
      errorMessage={submitError}
      submitLabel={initialIncome ? "Enregistrer" : "Créer"}
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
          value={formData.categoryId || formData.categoryName || formData.category}
          onChange={(event) => {
            const selectedCategory = incomeCategories.find((category) => category.id === event.target.value);
            const selectedName = selectedCategory?.name || event.target.value;

            setFormData((prev) => ({
              ...prev,
              categoryId: selectedCategory?.id || "",
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
          {incomeCategories.length > 0
            ? incomeCategories.map((category) => (
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
          <MenuItem value="mensuel">Mensuel</MenuItem>
          <MenuItem value="annuel">Annuel</MenuItem>
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
