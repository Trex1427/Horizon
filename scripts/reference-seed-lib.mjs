export const SEED_SOURCE = "horizon-v4-reference-seed";
export const DEMO_SEED_SOURCE = "horizon-v4-demo-seed";

export const REQUIRED_PARENT_CATEGORIES = [
  { name: "Revenus professionnels", type: "revenu" },
  { name: "Aides et prestations", type: "revenu" },
];

export function normalizeName(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildNameIndex(docs = []) {
  const index = new Map();

  for (const doc of docs) {
    const key = normalizeName(doc?.name || "");
    if (!key || index.has(key)) {
      continue;
    }

    index.set(key, doc);
  }

  return index;
}

export function buildSubcategoryKey(categoryId = "", name = "") {
  const normalizedCategoryId = String(categoryId || "").trim();
  const normalizedName = normalizeName(name);

  if (!normalizedCategoryId || !normalizedName) {
    return "";
  }

  return `${normalizedCategoryId}::${normalizedName}`;
}

export function buildSubcategoryIndex(docs = []) {
  const index = new Map();

  for (const doc of docs) {
    const key = buildSubcategoryKey(doc?.categoryId, doc?.name);
    if (!key || index.has(key)) {
      continue;
    }

    index.set(key, doc);
  }

  return index;
}

export function classifySeedCandidatesByName(candidates = [], existingNameIndex, getName = (item) => item?.name) {
  const safeIndex = existingNameIndex || new Map();
  const created = [];
  const alreadyExisting = [];
  const seenCandidateKeys = new Set();

  for (const candidate of candidates) {
    const key = normalizeName(getName(candidate));
    if (!key) {
      continue;
    }

    if (safeIndex.has(key) || seenCandidateKeys.has(key)) {
      alreadyExisting.push(candidate);
      continue;
    }

    seenCandidateKeys.add(key);
    created.push(candidate);
  }

  return { created, alreadyExisting };
}

export function planRequiredCategories(existingCategories = [], requiredCategories = REQUIRED_PARENT_CATEGORIES) {
  const existingIndex = buildNameIndex(existingCategories);
  const toCreate = [];
  const alreadyExisting = [];

  for (const category of requiredCategories) {
    const key = normalizeName(category?.name || "");
    if (!key) {
      continue;
    }

    if (existingIndex.has(key)) {
      alreadyExisting.push(category);
      continue;
    }

    toCreate.push(category);
  }

  return {
    toCreate,
    alreadyExisting,
  };
}

export function planSubcategorySeed({
  categories = [],
  existingSubcategories = [],
  subcategoriesByParent = {},
} = {}) {
  const categoriesByName = buildNameIndex(categories);
  const existingIndex = buildSubcategoryIndex(existingSubcategories);
  const toCreate = [];
  const alreadyExisting = [];
  const missingParents = [];

  for (const [parentName, subcategoryNames] of Object.entries(subcategoriesByParent)) {
    const parent = categoriesByName.get(normalizeName(parentName));
    if (!parent?.id) {
      missingParents.push({
        parentName,
        skippedCount: (subcategoryNames || []).length,
      });
      continue;
    }

    const type = normalizeTransactionType(parent.type);

    for (const subcategoryName of subcategoryNames || []) {
      const key = buildSubcategoryKey(parent.id, subcategoryName);
      if (!key) {
        continue;
      }

      if (existingIndex.has(key)) {
        alreadyExisting.push({ parent, name: subcategoryName, type });
        continue;
      }

      existingIndex.set(key, {
        id: `${parent.id}:${normalizeName(subcategoryName)}`,
        categoryId: parent.id,
        name: subcategoryName,
      });

      toCreate.push({
        parent,
        name: subcategoryName,
        type,
      });
    }
  }

  return {
    toCreate,
    alreadyExisting,
    missingParents,
  };
}

export function classifyDemoTransactionsByFingerprint(candidates = [], existingTransactions = []) {
  const existingFingerprints = new Set(
    existingTransactions
      .map((transaction) => String(transaction?.seedFingerprint || "").trim())
      .filter(Boolean)
  );
  const created = [];
  const alreadyExisting = [];
  const seenFingerprints = new Set();

  for (const candidate of candidates) {
    const fingerprint = String(candidate?.seedFingerprint || "").trim();
    if (!fingerprint) {
      continue;
    }

    if (existingFingerprints.has(fingerprint) || seenFingerprints.has(fingerprint)) {
      alreadyExisting.push(candidate);
      continue;
    }

    seenFingerprints.add(fingerprint);
    created.push(candidate);
  }

  return { created, alreadyExisting };
}

export function countNonSeededTransactions(transactions = [], seedSource = DEMO_SEED_SOURCE) {
  return transactions.filter((transaction) => transaction?.seedSource !== seedSource).length;
}

export function resolveCategoryIdByName(categories = [], categoryName = "") {
  const categoriesByName = buildNameIndex(categories);
  return categoriesByName.get(normalizeName(categoryName))?.id || null;
}

export function resolveActivityIdByName(activities = [], activityName = "") {
  const activitiesByName = buildNameIndex(activities);
  return activitiesByName.get(normalizeName(activityName))?.id || null;
}

export function normalizeTransactionType(type = "") {
  const normalized = normalizeName(type);

  if (normalized === "revenu" || normalized === "income") {
    return "revenu";
  }

  return "depense";
}

export function collectSeedDocumentIds(docs = [], seedSource = SEED_SOURCE) {
  const seededIds = [];

  for (const doc of docs) {
    const id = String(doc?.id || "").trim();

    if (!id) {
      continue;
    }

    if (doc?.seedSource === seedSource) {
      seededIds.push(id);
    }
  }

  return seededIds;
}

export function buildCleanupPlanByCollection(collections = {}, seedSource = SEED_SOURCE) {
  const plan = {};

  for (const [collectionName, docs] of Object.entries(collections)) {
    const seededIds = collectSeedDocumentIds(Array.isArray(docs) ? docs : [], seedSource);

    plan[collectionName] = {
      seededIds,
      deleteCount: seededIds.length,
      nonSeededCount: Math.max((docs || []).length - seededIds.length, 0),
    };
  }

  return plan;
}
