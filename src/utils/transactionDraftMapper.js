import { isCreateReferenceValue } from "../constants/transactionReferenceCreateValues.js";
import { CREATE_FIXED_EXPENSE_VALUE } from "../constants/transactionFixedExpenseReference.js";

export function buildTransactionPayload(form, defaultAccountId = "") {
  const rawCategoryName = form.categoryName || form.categorie || "";
  const selectedCategoryName = isCreateReferenceValue(rawCategoryName) ? "" : rawCategoryName;
  const categoryId = isCreateReferenceValue(form.categoryId) ? null : form.categoryId || null;
  const subcategoryId = isCreateReferenceValue(form.subcategoryId) ? null : form.subcategoryId || null;
  const activityId = isCreateReferenceValue(form.activityId) ? null : form.activityId || null;
  const thirdPartyId = isCreateReferenceValue(form.thirdPartyId) ? null : form.thirdPartyId || null;
  const projectId = isCreateReferenceValue(form.projectId) ? null : form.projectId || null;
  const workProjectId = String(form.workProjectId || "" ).trim() || null;
  const accountId = isCreateReferenceValue(form.accountId) ? "" : form.accountId || defaultAccountId || "";
  const subcategoryName = subcategoryId ? form.subcategoryName || null : null;
  const activityName = activityId ? form.activityName || null : null;
  const thirdPartyName = thirdPartyId ? form.thirdPartyName || null : null;
  const projectName = projectId ? form.projectName || null : null;
  const rawFixedExpenseId = String(form.fixedExpenseId || "").trim();
  const isFixedExpense = form.type === "depense"
    && Boolean(form.isFixedExpense)
    && Boolean(rawFixedExpenseId)
    && rawFixedExpenseId !== CREATE_FIXED_EXPENSE_VALUE;
  const fixedExpenseId = isFixedExpense ? String(form.fixedExpenseId).trim() : null;

  return {
    date: form.date,
    montant: Number(form.montant),
    categorie: selectedCategoryName,
    categoryId,
    categoryName: selectedCategoryName,
    subcategoryId,
    subcategoryName,
    activityId,
    activityName,
    thirdPartyId,
    thirdPartyName,
    projectId,
    projectName,
    workProjectId,
    description: form.description,
    type: form.type,
    accountId,
    destinationAccountId: null,
    isFixedExpense,
    fixedExpenseId,
    opportunityId: form.opportunityId || null,
    opportunityName: form.opportunityName || null,
    opportunityNotes: form.opportunityNotes || null,
  };
}

export function validateTransactionForm(form) {
  if (!form?.date) {
    return "La date est obligatoire ❌";
  }

  if (!["depense", "revenu"].includes(form?.type)) {
    return "Le type doit etre depense ou revenu ❌";
  }

  if (!form.montant || Number(form.montant) <= 0) {
    return "Le montant doit etre superieur a 0 ❌";
  }

  if (isCreateReferenceValue(form.categoryName || form.categorie) || isCreateReferenceValue(form.categoryId)) {
    return "La categorie selectionnee est invalide ❌";
  }

  if (!form.accountId || isCreateReferenceValue(form.accountId)) {
    return "Le compte source est obligatoire ❌";
  }

  return "";
}
