import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils.js";
import { normalizeTransactionType } from "../utils/transactionTypeUtils.js";

function toTrimmedString(value) {
  return String(value || "").trim();
}

function getNormalizedCategory(category = null, fallbackName = "") {
  const categoryName = getSafeCategoryLabel(category?.name || fallbackName, "");
  return {
    categoryId: category?.id || "",
    categoryName,
    category: categoryName,
  };
}

export function getExpenseCategoryOptions(categories = []) {
  return categories
    .filter((category) => normalizeTransactionType(category.type) === "depense")
    .filter((category) => !isTechnicalCategoryDisplayValue(category.name));
}

export function getIncomeCategoryOptions(categories = []) {
  return categories
    .filter((category) => normalizeTransactionType(category.type) === "revenu")
    .filter((category) => !isTechnicalCategoryDisplayValue(category.name));
}

export function validateFixedExpenseForm(formData = {}) {
  const nextErrors = {};

  if (!toTrimmedString(formData.name)) {
    nextErrors.name = "Le nom est requis";
  }

  if (!toTrimmedString(formData.categoryId) && !toTrimmedString(formData.categoryName) && !toTrimmedString(formData.category)) {
    nextErrors.category = "La catégorie est requise";
  }

  if (!toTrimmedString(formData.accountId)) {
    nextErrors.accountId = "Le compte est requis";
  }

  const initialAmount = Number(formData.initialAmount);
  if (!toTrimmedString(formData.initialAmount) || Number.isNaN(initialAmount) || initialAmount <= 0) {
    nextErrors.initialAmount = "Un montant initial valide est requis";
  }

  if (!toTrimmedString(formData.startDate)) {
    nextErrors.startDate = "La date de début est requise";
  }

  const amountType = toTrimmedString(formData.amountType || "fixed");
  if (amountType !== "fixed" && amountType !== "variable") {
    nextErrors.amountType = "Le type de montant est invalide";
  }

  return nextErrors;
}

export function buildFixedExpensePayload(formData = {}, categories = [], initialExpense = null, subcategories = []) {
  const selectedCategory = getExpenseCategoryOptions(categories).find((category) => category.id === formData.categoryId);
  const normalizedCategory = getNormalizedCategory(selectedCategory, formData.categoryName || formData.category || initialExpense?.categoryName || "");
  const selectedSubcategory = subcategories.find((subcategory) => (
    subcategory.id === formData.subcategoryId
    && subcategory.isActive !== false
  ));

  return {
    name: toTrimmedString(formData.name),
    ...normalizedCategory,
    amountType: toTrimmedString(formData.amountType || "fixed") === "variable" ? "variable" : "fixed",
    subcategoryId: selectedSubcategory?.id || null,
    subcategoryName: selectedSubcategory?.name || null,
    accountId: formData.accountId || null,
    frequency: formData.frequency || "monthly",
    initialAmount: Number(formData.initialAmount),
    startDate: formData.startDate || null,
    endDate: formData.endDate || null,
    description: toTrimmedString(formData.description),
    variations: Array.isArray(formData.variations)
      ? formData.variations
          .filter((variation) => variation.effectiveDate || variation.amount || variation.note)
          .map((variation) => ({
            effectiveDate: variation.effectiveDate,
            amount: Number(variation.amount || 0),
            note: toTrimmedString(variation.note),
          }))
      : [],
    isActive: initialExpense?.isActive ?? true,
  };
}

export function validateRecurringIncomeForm(formData = {}) {
  const nextErrors = {};

  if (!toTrimmedString(formData.name)) {
    nextErrors.name = "Le nom est requis";
  }

  if (!toTrimmedString(formData.categoryId) && !toTrimmedString(formData.categoryName) && !toTrimmedString(formData.category)) {
    nextErrors.category = "La catégorie est requise";
  }

  if (!toTrimmedString(formData.accountId)) {
    nextErrors.accountId = "Le compte est requis";
  }

  const initialAmount = Number(formData.initialAmount);
  if (!toTrimmedString(formData.initialAmount) || Number.isNaN(initialAmount) || initialAmount <= 0) {
    nextErrors.initialAmount = "Un montant initial valide est requis";
  }

  if (!toTrimmedString(formData.startDate)) {
    nextErrors.startDate = "La date de début est requise";
  }

  return nextErrors;
}

export function buildRecurringIncomePayload(formData = {}, categories = [], initialIncome = null) {
  const selectedCategory = getIncomeCategoryOptions(categories).find((category) => category.id === formData.categoryId);
  const normalizedCategory = getNormalizedCategory(selectedCategory, formData.categoryName || formData.category || initialIncome?.categoryName || "");

  return {
    name: toTrimmedString(formData.name),
    ...normalizedCategory,
    accountId: formData.accountId || null,
    frequency: formData.frequency || "mensuel",
    initialAmount: Number(formData.initialAmount),
    startDate: formData.startDate || null,
    endDate: formData.endDate || null,
    variations: Array.isArray(formData.variations)
      ? formData.variations
          .filter((variation) => variation.effectiveDate || variation.amount || variation.note)
          .map((variation) => ({
            effectiveDate: variation.effectiveDate,
            amount: Number(variation.amount || 0),
            note: toTrimmedString(variation.note),
          }))
      : [],
    isActive: initialIncome?.isActive ?? true,
  };
}
