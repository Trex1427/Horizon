export function buildLegacyReclassificationPayload(transaction = {}, nextType = "depense", options = {}) {
  const fallbackCategory = options.fallbackCategory || { id: "", name: "" };
  const defaultAccountId = options.defaultAccountId || "";

  return {
    date: transaction.date || new Date().toISOString().slice(0, 10),
    montant: Number(transaction.montant || 0),
    description: transaction.description || "",
    type: nextType,
    accountId: transaction.accountId || defaultAccountId,
    categoryId: transaction.categoryId || fallbackCategory.id || "",
    categoryName: transaction.categoryName || transaction.categorie || fallbackCategory.name || "",
    categorie: transaction.categorie || transaction.categoryName || fallbackCategory.name || "",
    subcategoryId: transaction.subcategoryId || null,
    activityId: transaction.activityId || null,
    thirdPartyId: transaction.thirdPartyId || null,
    projectId: transaction.projectId || null,
    updatedAt: new Date().toISOString(),
  };
}
