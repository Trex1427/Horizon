const TYPES = new Set(["debt", "receivable"]);

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
  if (!String(values.counterparty || "").trim()) errors.counterparty = "La contrepartie est obligatoire.";
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
    counterparty: String(values.counterparty).trim(),
    dueDate: values.dueDate || null,
    notes: String(values.notes || "").trim() || null,
    status: "open",
    updatedAt: now,
  };
}

export function buildDebtReceivableCreatePayload(values = {}, now = new Date()) {
  return {
    ...buildDebtReceivablePayload(values, now),
    createdAt: now,
    isDeleted: false,
  };
}

function safeAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function calculateDebtsReceivablesSummary(items = []) {
  const active = items.filter((item) => item?.isDeleted !== true && item?.status === "open");
  const debts = active.reduce((sum, item) => sum + (item.type === "debt" ? safeAmount(item.amount) : 0), 0);
  const receivables = active.reduce((sum, item) => sum + (item.type === "receivable" ? safeAmount(item.amount) : 0), 0);
  return { debts, receivables, net: receivables - debts };
}
