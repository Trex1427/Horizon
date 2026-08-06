import { DEFAULT_CATEGORY_DEFINITIONS } from "../constants/categoryDefaults.js";

function normalizeCategoryName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function slugify(value = "") {
  return normalizeCategoryName(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildCategoryKey(category = {}) {
  return `${normalizeCategoryName(category.name)}::${normalizeCategoryName(category.type || "depense")}`;
}

export function buildDefaultCategoryDocumentId(ownerUid = "", categoryName = "") {
  const normalizedOwnerUid = String(ownerUid || "").trim();

  if (!normalizedOwnerUid) {
    throw new Error("ownerUid is required to build a default category document id.");
  }

  return `${normalizedOwnerUid}_default-category-${slugify(categoryName)}`;
}

export function buildDefaultCategoryDocuments({ ownerUid, existingCategories = [], now = () => new Date().toISOString() } = {}) {
  const existingByKey = new Map();

  for (const category of existingCategories) {
    const key = buildCategoryKey(category);

    if (!key || existingByKey.has(key)) {
      continue;
    }

    existingByKey.set(key, category);
  }

  const timestamp = now();

  return DEFAULT_CATEGORY_DEFINITIONS.flatMap((definition) => {
    const key = buildCategoryKey(definition);

    if (existingByKey.has(key)) {
      return [];
    }

    return [{
      id: buildDefaultCategoryDocumentId(ownerUid, definition.name),
      data: {
        name: definition.name,
        nameNormalized: normalizeCategoryName(definition.name),
        type: definition.type,
        icon: definition.icon,
        color: definition.color,
        displayOrder: definition.displayOrder,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    }];
  });
}
