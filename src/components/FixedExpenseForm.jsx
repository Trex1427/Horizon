import { useEffect, useMemo, useState } from "react";
import {
  buildFixedExpensePayload,
  getExpenseCategoryOptions,
  validateFixedExpenseForm,
} from "../services/recurringAndFixedFormPayloads";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import { buildExpenseCategoryReference, getCanonicalCategoryId } from "../utils/categorySelectionModel";
import {
  getFixedExpenseSubcategoryOptions,
  resetIncompatibleFixedExpenseSubcategory,
} from "../utils/fixedExpenseFormUtils";
import {
  Card,
  CurrencyInput,
  DatePicker,
  Dialog,
  ErrorState,
  Input,
  PrimaryButton,
  SecondaryButton,
  SectionCard,
  Select,
} from "./ui";

const defaultForm = {
  name: "",
  amountType: "fixed",
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
  const categoryReference = useMemo(
    () => buildExpenseCategoryReference(categories, subcategories),
    [categories, subcategories]
  );

  const expenseCategories = useMemo(() => {
    if (categoryReference.categoryOptions.length > 0) return categoryReference.categoryOptions;
    return getExpenseCategoryOptions(categories);
  }, [categories, categoryReference]);
  const subcategoryOptions = useMemo(
    () => getFixedExpenseSubcategoryOptions(subcategories, formData.categoryId, categoryReference),
    [categoryReference, formData.categoryId, subcategories]
  );

  // The dialog intentionally rehydrates its local draft whenever the edited entity changes.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (initialExpense) {
      const initialCategoryName = initialExpense.categoryName || initialExpense.category || "";
      const canonicalCategoryId = getCanonicalCategoryId(categoryReference, initialExpense.categoryId || "");
      const selectedCategory =
        expenseCategories.find((category) => category.id === canonicalCategoryId) ||
        expenseCategories.find(
          (category) => normalizeCategoryName(category.name) === normalizeCategoryName(initialCategoryName)
        );

      setFormData({
        name: initialExpense.name || "",
        amountType: initialExpense.amountType === "variable" ? "variable" : "fixed",
        categoryId: canonicalCategoryId || selectedCategory?.id || "",
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
    console.log("[CREATE FIXED]", "service =", "FixedExpenseForm");
    console.log("[CREATE FIXED]", "function =", "handleSubmit");
    if (!validate()) return;

    const payload = buildFixedExpensePayload({ ...formData, variations }, expenseCategories, initialExpense, subcategories);

    setSubmitting(true);
    setErrors((prev) => ({ ...prev, submit: null }));
    let result;
    try {
      console.log("[CREATE FIXED]", "next =", "onSubmit(payload)");
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
    <Dialog
      open={open}
      title={initialExpense ? "Modifier un frais fixe" : "Créer un frais fixe"}
      description="Renseignez un référentiel stable, une fréquence et des dates lisibles."
      onClose={onClose}
      size="lg"
      actions={(
        <>
          <SecondaryButton onClick={onClose} disabled={isLoading || submitting}>Annuler</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={isLoading || submitting}>
            {isLoading || submitting ? "Enregistrement..." : (initialExpense ? "Enregistrer" : "Créer")}
          </PrimaryButton>
        </>
      )}
    >
      <div>
        {errors.submit ? <ErrorState unstyled as="div" className="hui-feedback hui-feedback--danger">{errors.submit}</ErrorState> : null}

        <SectionCard title="Informations" description="Identifiez clairement le frais fixe." className="hui-card--outlined">
          <Input label="Nom" name="name" value={formData.name} onChange={handleChange} error={errors.name} />
          <Select
            label="Catégorie"
            name="categoryId"
            value={formData.categoryId}
            onChange={(event) => {
              const canonicalCategoryId = getCanonicalCategoryId(categoryReference, event.target.value);
              const selectedCategory = expenseCategories.find((category) => category.id === canonicalCategoryId);
              const selectedName = selectedCategory?.name || "";

              setFormData((prev) => ({
                ...resetIncompatibleFixedExpenseSubcategory(prev, canonicalCategoryId, subcategories, categoryReference),
                categoryName: selectedName,
                category: selectedName,
              }));

              if (errors.category) {
                setErrors((prev) => ({ ...prev, category: null }));
              }
            }}
            error={errors.category}
          >
            <option value="">Sélectionner une catégorie</option>
            {expenseCategories.length > 0
              ? expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>{getSafeCategoryLabel(category.name)}</option>
              ))
              : LEGACY_CATEGORY_OPTIONS.map((categoryName) => (
                <option key={categoryName} value={categoryName}>{categoryName}</option>
              ))}
          </Select>
          <Select
            label="Sous-catégorie"
            name="subcategoryId"
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
            disabled={!formData.categoryId}
            error={errors.subcategoryId}
            hint={!formData.categoryId ? "Sélectionnez d’abord une catégorie" : "Laisser vide pour un frais fixe de catégorie"}
          >
            <option value="">Aucune</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
            ))}
          </Select>
        </SectionCard>

        <SectionCard title="Valeurs" description="Paramétrez le type, le montant, la périodicité et le compte." className="hui-card--outlined">
          <Select label="Type de montant" name="amountType" value={formData.amountType} onChange={handleChange} error={errors.amountType}>
            <option value="fixed">Montant fixe</option>
            <option value="variable">Montant variable</option>
          </Select>
          <CurrencyInput
            label="Montant"
            name="initialAmount"
            value={formData.initialAmount}
            onChange={handleChange}
            error={errors.initialAmount}
            min="0"
            step="0.01"
          />
          <Select label="Périodicité" name="frequency" value={formData.frequency} onChange={handleChange}>
            <option value="monthly">Mensuel</option>
            <option value="annual">Annuel</option>
          </Select>
          <Select
            label="Compte"
            name="accountId"
            value={formData.accountId}
            onChange={handleChange}
            error={errors.accountId}
          >
            <option value="">Sélectionner un compte</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
        </SectionCard>

        <SectionCard title="Dates" description="Cadrez le démarrage et la fin éventuelle." className="hui-card--outlined">
          <DatePicker
            label="Début"
            name="startDate"
            value={formData.startDate}
            onChange={handleChange}
            error={errors.startDate}
          />
          <DatePicker
            label="Fin"
            name="endDate"
            value={formData.endDate}
            onChange={handleChange}
            hint="Uniquement si nécessaire"
          />
        </SectionCard>

        <details>
          <summary>Options avancées</summary>
          <SectionCard title="Options avancées" description="Ajoutez les détails utiles sans surcharger le formulaire." className="hui-card--outlined">
            <Input
              label="Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
            />
            <SecondaryButton onClick={addVariation}>Ajouter une variation</SecondaryButton>
            {variations.length === 0 ? (
              <Card className="hui-card--outlined">Aucune variation pour le moment.</Card>
            ) : (
              variations.map((variation, index) => (
                <Card className="hui-card--outlined" key={`variation-${index}`}>
                  <p>Variation {index + 1}</p>
                  <DatePicker
                    label="Date d’effet"
                    name="effectiveDate"
                    value={variation.effectiveDate || ""}
                    onChange={(event) => handleVariationChange(index, event)}
                  />
                  <CurrencyInput
                    label="Montant"
                    name="amount"
                    value={variation.amount || ""}
                    onChange={(event) => handleVariationChange(index, event)}
                    min="0"
                    step="0.01"
                  />
                  <Input
                    label="Note"
                    name="note"
                    value={variation.note || ""}
                    onChange={(event) => handleVariationChange(index, event)}
                  />
                  <SecondaryButton onClick={() => removeVariation(index)}>Supprimer cette variation</SecondaryButton>
                </Card>
              ))
            )}
          </SectionCard>
        </details>
      </div>
    </Dialog>
  );
}
