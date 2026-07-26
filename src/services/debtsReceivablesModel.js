const TYPES = new Set(["debt", "receivable"]);

function toCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.round(amount * 100);
}

function fromCents(value) {
  return Number.isFinite(value) ? value / 100 : 0;
}

export function isValidDateString(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateDebtReceivable(values = {}) {
  const errors = {};
  const amount = Number(values.amount);
  if (!TYPES.has(values.type)) errors.type = "Sélectionnez Dette ou Créance.";
  if (!String(values.label || "").trim()) errors.label = "Le libellé est obligatoire.";
  if (!String(values.thirdPartyId || "").trim()) errors.thirdPartyId = "Le tiers est obligatoire.";
  if (!String(values.categoryId || "").trim()) errors.categoryId = "La catégorie est obligatoire.";
  if (values.type === "receivable" && !String(values.initialCategoryId || "").trim()) errors.initialCategoryId = "La catégorie de la sortie initiale est obligatoire.";
  if (values.type === "receivable" && !String(values.initialAccountId || "").trim()) errors.initialAccountId = "Le compte de sortie est obligatoire.";
  if (values.type === "receivable" && !isValidDateString(values.initialDate)) errors.initialDate = "La date de sortie est invalide.";
  if (values.type === "receivable" && !String(values.initialDate || "").trim()) errors.initialDate = "La date de sortie est obligatoire.";
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Le montant doit être strictement supérieur à zéro.";
  if (!isValidDateString(values.dueDate)) errors.dueDate = "La date d’échéance est invalide.";
  return errors;
}

export function buildDebtReceivablePayload(values = {}, now = new Date()) {
  const errors = validateDebtReceivable(values);
  if (Object.keys(errors).length) {
    const error = new Error("Les informations saisies sont invalides.");
    error.validationErrors = errors;
    throw error;
  }
  return {
    type: values.type,
    label: String(values.label).trim(),
    amount: Number(values.amount),
    thirdPartyId: String(values.thirdPartyId || "").trim(),
    categoryId: String(values.categoryId || "").trim(),
    initialCategoryId: values.type === "receivable" ? String(values.initialCategoryId || "").trim() : null,
    initialAccountId: values.type === "receivable" ? String(values.initialAccountId || "").trim() : null,
    initialDate: values.type === "receivable" ? String(values.initialDate || "").trim() : null,
    dueDate: values.dueDate || null,
    notes: String(values.notes || "").trim() || null,
    updatedAt: now,
  };
}

export function buildDebtReceivableCreatePayload(values = {}, now = new Date()) {
  return {
    ...buildDebtReceivablePayload(values, now),
    createdAt: now,
    isDeleted: false,
    paymentsRevision: 0,
  };
}

function safeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function calculateDebtsReceivablesSummary(items = []) {
  const active = items.filter((item) => item?.isDeleted !== true && item?.functionalStatus !== "paid");
  const debts = active.reduce((sum, item) => sum + (item.type === "debt" ? safeAmount(item.amount) : 0), 0);
  const receivables = active.reduce((sum, item) => sum + (item.type === "receivable" ? safeAmount(item.amount) : 0), 0);
  return { debts, receivables, net: receivables - debts };
}

function computeFunctionalStatus(totalCents, paidCents) {
  if (paidCents <= 0) return "unpaid";
  if (paidCents >= totalCents) return "paid";
  return "partial";
}

export function enrichDebtReceivableWithPayments(item, payments = []) {
  const safeItem = item || {};
  const activePayments = (payments || []).filter((payment) => payment?.isDeleted !== true);
  const totalCents = Math.max(0, toCents(safeItem.amount));
  const paidCents = Math.min(totalCents, activePayments.reduce((sum, payment) => sum + Math.max(0, toCents(payment.amount)), 0));
  const remainingCents = Math.max(totalCents - paidCents, 0);

  return {
    ...safeItem,
    paidAmount: fromCents(paidCents),
    remainingAmount: fromCents(remainingCents),
    functionalStatus: computeFunctionalStatus(totalCents, paidCents),
  };
}
export function calculateReceivableCashImpact(initialAmount, repayments = []) {
  const initialCents = Math.max(0, toCents(initialAmount));
  const repaymentCents = (repayments || []).filter((payment) => payment?.isDeleted !== true).reduce((sum, payment) => sum + Math.max(0, toCents(payment?.amount)), 0);
  return fromCents(repaymentCents - initialCents);
}