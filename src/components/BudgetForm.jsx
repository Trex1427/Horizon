import { useEffect, useMemo, useRef, useState } from "react";
import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";
import { getBudgetSubcategoryOptions, resetIncompatibleBudgetSubcategory } from "../utils/budgetFormUtils";
import { buildExpenseCategoryReference, getCanonicalCategoryId } from "../utils/categorySelectionModel";
import {
  CurrencyInput,
  DatePicker,
  Dialog,
  ErrorState,
  Input,
  PrimaryButton,
  SectionCard,
  SecondaryButton,
  Select,
} from "./ui";

const defaultForm = {
  name: "",
  categoryId: "",
  categoryName: "",
  subcategoryId: "",
  subcategoryName: "",
  accountId: "",
  amount: "",
  periodicity: "annual",
  rollingPeriod: false,
  startDate: "",
  endDate: "",
};

const PERIODICITY_OPTIONS = [
  { value: "monthly", label: "Mensuelle" },
  { value: "quarterly", label: "Trimestrielle" },
  { value: "semiAnnual", label: "Semestrielle" },
  { value: "annual", label: "Annuelle" },
  { value: "custom", label: "Personnalisée" },
];

const TRACKING_OPTIONS = [
  { value: "fixed", label: "Période fixe" },
  { value: "rolling", label: "Période glissante" },
];

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
  const categoryReference = useMemo(
    () => buildExpenseCategoryReference(categories, subcategories),
    [categories, subcategories]
  );
  const categoryOptions = useMemo(() => {
    const canonicalOptions = categoryReference.categoryOptions;
    if (canonicalOptions.length > 0) return canonicalOptions;

    return categories
      .filter((category) => normalizeTransactionType(category.type) === "depense")
      .filter((category) => !isTechnicalCategoryDisplayValue(category.name));
  }, [categories, categoryReference]);
  const subcategoryOptions = useMemo(
    () => getBudgetSubcategoryOptions(subcategories, formData.categoryId, categoryReference),
    [categoryReference, formData.categoryId, subcategories]
  );

  useEffect(() => {
    if (initialBudget) {
      const canonicalCategoryId = getCanonicalCategoryId(categoryReference, initialBudget.categoryId || "");
      const selectedCategory = categoryOptions.find((category) => category.id === canonicalCategoryId);
      const selectedSubcategory = subcategories.find((subcategory) => subcategory.id === initialBudget.subcategoryId);
      setFormData({
        name: initialBudget.name || "",
        categoryId: canonicalCategoryId,
        categoryName: getSafeCategoryLabel(initialBudget.categoryName || selectedCategory?.name, ""),
        subcategoryId: initialBudget.subcategoryId || "",
        subcategoryName: initialBudget.subcategoryName || selectedSubcategory?.name || "",
        accountId: initialBudget.accountId || "",
        amount: String(initialBudget.amount ?? ""),
        periodicity: initialBudget.periodicity || "annual",
        rollingPeriod: initialBudget.rollingPeriod === true,
        startDate: initialBudget.startDate || "",
        endDate: initialBudget.endDate || "",
      });
    } else {
      setFormData({ ...defaultForm });
    }
    setErrors({});
  }, [categories, categoryOptions, categoryReference, initialBudget, open, subcategories]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => {
      if (name === "trackingMode") {
        return { ...previous, rollingPeriod: value === "rolling" };
      }

      if (name === "periodicity") {
        return {
          ...previous,
          periodicity: value,
          endDate: value === "custom" ? previous.endDate : "",
        };
      }

      return { ...previous, [name]: value };
    });
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
    if (!formData.periodicity) nextErrors.periodicity = "La périodicité est requise";
    if (formData.periodicity === "custom" && !formData.endDate) nextErrors.endDate = "La date de fin est requise pour une période personnalisée";
    if (formData.periodicity === "custom" && formData.endDate && formData.startDate && formData.endDate < formData.startDate) {
      nextErrors.endDate = "La date de fin doit être postérieure ou égale à la date de début";
    }

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
      periodicity: formData.periodicity,
      rollingPeriod: formData.rollingPeriod,
      startDate: formData.startDate || null,
      endDate: formData.periodicity === "custom" ? (formData.endDate || null) : null,
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
    <Dialog
      open={open}
      title={initialBudget ? "Modifier un budget" : "Créer un budget"}
      description="Structurez votre enveloppe avec une catégorie unique et un suivi clair."
      onClose={onClose}
      size="lg"
      actions={(
        <>
          <SecondaryButton onClick={onClose} disabled={isLoading || isSubmitting}>Annuler</SecondaryButton>
          <PrimaryButton onClick={handleSubmit} disabled={isLoading || isSubmitting}>
            {isLoading || isSubmitting ? "Enregistrement..." : (initialBudget ? "Enregistrer" : "Créer")}
          </PrimaryButton>
        </>
      )}
    >
      <div>
        {errors.submit ? <ErrorState unstyled as="div" className="hui-feedback hui-feedback--danger">{errors.submit}</ErrorState> : null}

        <SectionCard title="Informations" description="Décrivez le budget et son rattachement." className="hui-card--outlined">
          <Input label="Nom" name="name" value={formData.name} onChange={handleChange} error={errors.name} />
          <Select
            label="Catégorie"
            name="categoryId"
            value={formData.categoryId}
            onChange={(event) => {
              const nextCategoryId = event.target.value;
              const canonicalCategoryId = getCanonicalCategoryId(categoryReference, nextCategoryId);
              const selectedCategory = categoryOptions.find((category) => category.id === canonicalCategoryId);
              setFormData((previous) => ({
                ...resetIncompatibleBudgetSubcategory(previous, canonicalCategoryId, subcategories, categoryReference),
                categoryName: selectedCategory?.name || "",
              }));
              setErrors((previous) => ({ ...previous, categoryId: null, subcategoryId: null, submit: null }));
            }}
            error={errors.categoryId}
          >
            <option value="">Sélectionner une catégorie</option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.id}>{getSafeCategoryLabel(category.name)}</option>
            ))}
          </Select>
          <Select
            label="Sous-catégorie"
            name="subcategoryId"
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
            error={errors.subcategoryId}
            hint={!formData.categoryId ? "Sélectionnez d’abord une catégorie" : "Laisser vide pour un budget global de catégorie"}
          >
            <option value="">Aucune</option>
            {subcategoryOptions.map((subcategory) => (
              <option key={subcategory.id} value={subcategory.id}>{subcategory.name}</option>
            ))}
          </Select>
        </SectionCard>

        <SectionCard title="Valeurs" description="Définissez le montant, la périodicité et le type de suivi." className="hui-card--outlined">
          <CurrencyInput
            label="Montant"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            error={errors.amount}
            min="0"
            step="0.01"
          />
          <Select label="Périodicité" name="periodicity" value={formData.periodicity} onChange={handleChange} error={errors.periodicity}>
            {PERIODICITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <Select label="Type" name="trackingMode" value={formData.rollingPeriod ? "rolling" : "fixed"} onChange={handleChange}>
            {TRACKING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
        </SectionCard>

        <SectionCard title="Dates" description="Cadrez la période de référence." className="hui-card--outlined">
          <DatePicker label="Début" name="startDate" value={formData.startDate} onChange={handleChange} error={errors.startDate} />
          {formData.periodicity === "custom" ? (
            <DatePicker label="Fin" name="endDate" value={formData.endDate} onChange={handleChange} error={errors.endDate} />
          ) : null}
        </SectionCard>

        <details>
          <summary>Options avancées</summary>
          <SectionCard title="Options avancées" description="Paramètres secondaires du budget." className="hui-card--outlined">
            <Input
              label="Compte lié (optionnel)"
              name="accountId"
              value={formData.accountId}
              onChange={handleChange}
              hint="Laissez vide pour un budget transversal."
            />
          </SectionCard>
        </details>
      </div>
    </Dialog>
  );
}
