function toAmount(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : NaN;
}

export function validateTransferPayload(payload = {}) {
  const sourceAccountId = String(payload.sourceAccountId || "").trim();
  const destinationAccountId = String(payload.destinationAccountId || "").trim();
  const amount = toAmount(payload.amount);

  if (!payload.date) {
    return "La date du transfert est obligatoire.";
  }

  if (!sourceAccountId) {
    return "Le compte source est obligatoire.";
  }

  if (!destinationAccountId) {
    return "Le compte destination est obligatoire.";
  }

  if (sourceAccountId === destinationAccountId) {
    return "Le compte source et le compte destination doivent etre differents.";
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Le montant du transfert doit etre superieur a 0.";
  }

  return "";
}

export function normalizeTransferPayload(payload = {}) {
  const validationError = validateTransferPayload(payload);
  if (validationError) {
    throw new Error(validationError);
  }

  return {
    date: payload.date,
    amount: Number(payload.amount),
    sourceAccountId: String(payload.sourceAccountId).trim(),
    destinationAccountId: String(payload.destinationAccountId).trim(),
    description: String(payload.description || "").trim(),
    notes: String(payload.notes || "").trim(),
    isActive: payload.isActive !== false,
    createdAt: payload.createdAt || new Date().toISOString(),
    updatedAt: payload.updatedAt || new Date().toISOString(),
  };
}

export function calculateTransferImpactByAccount(transfer = {}) {
  const validationError = validateTransferPayload(transfer);
  if (validationError) {
    return null;
  }

  const amount = Number(transfer.amount);

  return {
    [transfer.sourceAccountId]: -amount,
    [transfer.destinationAccountId]: amount,
  };
}

export function calculateTransfersNetImpact(transfers = []) {
  return (transfers || []).reduce((sum, transfer) => {
    const impact = calculateTransferImpactByAccount(transfer);
    if (!impact) {
      return sum;
    }

    return sum + Object.values(impact).reduce((accountSum, value) => accountSum + Number(value || 0), 0);
  }, 0);
}
