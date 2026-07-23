const BULK_TRANSACTION_PATCH_FIELDS = new Set([
  "categoryId",
  "subcategoryId",
  "activityId",
  "thirdPartyId",
  "projectId",
  "accountId",
  "type",
]);

const OPTIONAL_REFERENCE_FIELDS = new Set(["subcategoryId", "activityId", "thirdPartyId", "projectId"]);

function normalizeId(value) {
  return String(value || "").trim();
}

function normalizeNullableReference(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = normalizeId(value);
  return normalized ? normalized : null;
}

function normalizeType(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (normalized === "depense" || normalized === "revenu") {
    return normalized;
  }

  return undefined;
}

export function buildBulkTransactionPatch(patch = {}) {
  return Object.entries(patch).reduce((accumulator, [key, value]) => {
    if (!BULK_TRANSACTION_PATCH_FIELDS.has(key)) {
      return accumulator;
    }

    if (key === "type") {
      const normalizedType = normalizeType(value);
      if (normalizedType) {
        accumulator.type = normalizedType;
      }
      return accumulator;
    }

    if (OPTIONAL_REFERENCE_FIELDS.has(key)) {
      const normalizedValue = normalizeNullableReference(value);
      if (normalizedValue !== undefined) {
        accumulator[key] = normalizedValue;
      }
      return accumulator;
    }

    if (key === "categoryId") {
      if (value !== undefined) {
        accumulator.categoryId = normalizeId(value);
      }
      return accumulator;
    }

    const normalizedValue = normalizeId(value);
    if (normalizedValue) {
      accumulator[key] = normalizedValue;
    }

    return accumulator;
  }, {});
}

export function splitTransactionIdsIntoBatches(transactionIds = [], batchSize = 450) {
  const safeBatchSize = Math.max(1, Number(batchSize) || 450);
  const ids = Array.isArray(transactionIds) ? [...transactionIds] : [];
  const batches = [];

  for (let index = 0; index < ids.length; index += safeBatchSize) {
    batches.push(ids.slice(index, index + safeBatchSize));
  }

  return batches;
}

function isActiveReference(reference) {
  return Boolean(reference) && reference.isActive !== false;
}

function getCategoryById(catalogs = {}, categoryId = "") {
  return catalogs?.categoryMap?.get?.(categoryId) || catalogs?.categories?.find?.((category) => category.id === categoryId) || null;
}

function getReferenceById(catalogMap, referenceId) {
  if (!catalogMap || !referenceId) {
    return null;
  }

  return catalogMap.get(referenceId) || null;
}

export function validateBulkTransactionPatchForTransaction(transaction = {}, patch = {}, catalogs = {}) {
  const resolved = resolveBulkTransactionPatchForTransaction(transaction, patch, catalogs);
  return resolved.ok ? "" : resolved.error;
}

export function resolveBulkTransactionPatchForTransaction(transaction = {}, patch = {}, catalogs = {}, options = {}) {
  const effectiveType = patch.type || transaction.type || "";
  const clearIncompatibleSubcategories = Boolean(options.clearIncompatibleSubcategories);

  if (effectiveType && !["depense", "revenu"].includes(effectiveType)) {
    return { ok: false, error: "Type de transaction invalide" };
  }

  if (patch.accountId) {
    const account = getReferenceById(catalogs?.accountMap, patch.accountId);
    if (!account) {
      return { ok: false, error: "Compte inexistant" };
    }
  }

  if (patch.categoryId) {
    const category = getCategoryById(catalogs, patch.categoryId);
    if (!category) {
      return { ok: false, error: "Categorie inexistante" };
    }

    if (!isActiveReference(category)) {
      return { ok: false, error: "Categorie inactive" };
    }

    if (patch.type && String(category.type || "").trim() && String(category.type).trim() !== patch.type) {
      return { ok: false, error: "Categorie incompatible avec le type" };
    }
  }

  const effectiveCategoryId = patch.categoryId || transaction.categoryId || "";
  const currentSubcategory = getReferenceById(catalogs?.subcategoryMap, transaction.subcategoryId || "");
  const requestedSubcategory = patch.subcategoryId ? getReferenceById(catalogs?.subcategoryMap, patch.subcategoryId) : null;

  if (patch.subcategoryId) {
    if (!requestedSubcategory) {
      return { ok: false, error: "Sous-categorie inexistante" };
    }

    if (!isActiveReference(requestedSubcategory)) {
      return { ok: false, error: "Sous-categorie inactive" };
    }

    if (effectiveCategoryId && normalizeId(requestedSubcategory.categoryId) !== normalizeId(effectiveCategoryId)) {
      return { ok: false, error: "Sous-categorie incompatible avec la categorie" };
    }
  }

  if (!patch.subcategoryId && patch.categoryId && currentSubcategory) {
    const currentCompatibleCategoryId = normalizeId(currentSubcategory.categoryId);
    const nextCategoryId = normalizeId(patch.categoryId);

    if (currentCompatibleCategoryId && nextCategoryId && currentCompatibleCategoryId !== nextCategoryId) {
      if (!clearIncompatibleSubcategories) {
        return { ok: false, error: "Sous-categorie incompatible avec la nouvelle categorie" };
      }
    }
  }

  if (patch.activityId) {
    const activity = getReferenceById(catalogs?.activityMap, patch.activityId);
    if (!activity) {
      return { ok: false, error: "Activite inexistante" };
    }

    if (!isActiveReference(activity)) {
      return { ok: false, error: "Activite inactive" };
    }
  }

  if (patch.thirdPartyId) {
    const thirdParty = getReferenceById(catalogs?.thirdPartyMap, patch.thirdPartyId);
    if (!thirdParty) {
      return { ok: false, error: "Tiers inexistant" };
    }

    if (!isActiveReference(thirdParty)) {
      return { ok: false, error: "Tiers inactif" };
    }
  }

  if (patch.projectId) {
    const project = getReferenceById(catalogs?.projectMap, patch.projectId);
    if (!project) {
      return { ok: false, error: "Projet inexistant" };
    }

    if (!isActiveReference(project)) {
      return { ok: false, error: "Projet inactif" };
    }
  }

  const resolvedPatch = { ...patch };
  if (!patch.subcategoryId && patch.categoryId && currentSubcategory && clearIncompatibleSubcategories) {
    const currentCompatibleCategoryId = normalizeId(currentSubcategory.categoryId);
    const nextCategoryId = normalizeId(patch.categoryId);

    if (currentCompatibleCategoryId && nextCategoryId && currentCompatibleCategoryId !== nextCategoryId) {
      resolvedPatch.subcategoryId = null;
      resolvedPatch.subcategoryName = null;
    }
  }

  return { ok: true, patch: resolvedPatch };
}

export function summarizeBulkTransactionPatch(patch = {}, selectionCount = 0) {
  const lines = [];
  const safeCount = Number(selectionCount) || 0;

  if (patch.categoryId) {
    lines.push(`Categorie : ${patch.categoryName || patch.categoryId}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "subcategoryId")) {
    lines.push(`Sous-categorie : ${patch.subcategoryId ? (patch.subcategoryName || patch.subcategoryId) : "Effacer"}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "activityId")) {
    lines.push(`Activite : ${patch.activityId ? (patch.activityName || patch.activityId) : "Effacer"}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "thirdPartyId")) {
    lines.push(`Tiers : ${patch.thirdPartyId ? (patch.thirdPartyName || patch.thirdPartyId) : "Effacer"}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "projectId")) {
    lines.push(`Projet : ${patch.projectId ? (patch.projectName || patch.projectId) : "Effacer"}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "accountId")) {
    lines.push(`Compte : ${patch.accountName || patch.accountId}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, "type")) {
    lines.push(`Type : ${patch.type}`);
  }

  return {
    title: `${safeCount} transaction${safeCount > 1 ? "s" : ""} seront modifiees`,
    lines,
  };
}
