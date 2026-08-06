import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  writeBatch,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { DEFAULT_SUBCATEGORY_SEED } from "../constants/referenceCatalog.js";
import {
  normalizeSubcategoryPayloadForCreate,
  normalizeSubcategoryPayloadForUpdate,
} from "./referencePayloadNormalizers.js";

const SUBCATEGORIES_COLLECTION = "subcategories";
const TRANSACTIONS_COLLECTION = "transactions";

export function subscribeToSubcategories(onData, onError, options = {}) {
  const ownerUid = requireCurrentUid(auth);
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? query(collection(db, SUBCATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid))
    : query(collection(db, SUBCATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true));

  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .sort((left, right) => String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" }));
      onData(data);
    },
    (error) => onError?.(error)
  );
}

export async function seedDefaultSubcategories() {
  const ownerUid = requireCurrentUid(auth);
  const [categorySnapshot, subcategorySnapshot] = await Promise.all([
    getDocs(query(collection(db, "categories"), where("ownerUid", "==", ownerUid))),
    getDocs(query(collection(db, SUBCATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid))),
  ]);

  const normalizeName = (value = "") => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const subcategoryCountByCategoryId = new Map();
  subcategorySnapshot.docs.forEach((entry) => {
    const categoryId = String(entry.data().categoryId || "");
    subcategoryCountByCategoryId.set(categoryId, (subcategoryCountByCategoryId.get(categoryId) || 0) + 1);
  });

  const categoriesByName = new Map();
  categorySnapshot.docs.forEach((entry) => {
    const data = entry.data() || {};
    if (data.isActive === false) return;
    const key = normalizeName(data.name);
    if (!key) return;

    const current = categoriesByName.get(key);
    if (!current) {
      categoriesByName.set(key, { id: entry.id, displayOrder: Number(data.displayOrder || 0), linkedSubcategories: subcategoryCountByCategoryId.get(entry.id) || 0 });
      return;
    }

    const next = { id: entry.id, displayOrder: Number(data.displayOrder || 0), linkedSubcategories: subcategoryCountByCategoryId.get(entry.id) || 0 };
    if (next.linkedSubcategories > current.linkedSubcategories) {
      categoriesByName.set(key, next);
      return;
    }
    if (next.linkedSubcategories === current.linkedSubcategories && next.displayOrder < current.displayOrder) {
      categoriesByName.set(key, next);
    }
  });

  const existing = new Set(subcategorySnapshot.docs.map((entry) => `${entry.data().categoryId}::${String(entry.data().name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`));
  const missing = DEFAULT_SUBCATEGORY_SEED.filter((item) => {
    const categoryId = categoriesByName.get(normalizeName(item.categoryName))?.id;
    return categoryId && !existing.has(`${categoryId}::${item.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}`);
  });
  if (!missing.length) return { success: true, created: false, createdCount: 0 };
  const batch = writeBatch(db);
  for (const item of missing) {
    const categoryId = categoriesByName.get(normalizeName(item.categoryName))?.id;
    const id = `${ownerUid}_default-${item.categoryName}-${item.name}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
    batch.set(doc(db, SUBCATEGORIES_COLLECTION, id), withOwnerUidForCreate({ name: item.name, categoryId, type: item.type, isActive: true, createdAt: new Date(), updatedAt: new Date() }, { auth }));
  }
  await batch.commit();
  return { success: true, created: true, createdCount: missing.length };
}
export async function createSubcategory(payload) {
  return addDoc(collection(db, SUBCATEGORIES_COLLECTION), withOwnerUidForCreate(normalizeSubcategoryPayloadForCreate(payload), { auth }));
}

export async function updateSubcategory(id, payload) {
  return updateDoc(doc(db, SUBCATEGORIES_COLLECTION, id), normalizeSubcategoryPayloadForUpdate(payload));
}

export async function deleteSubcategory(id) {
  return updateDoc(doc(db, SUBCATEGORIES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}

export async function isSubcategoryUsed(subcategoryId = "") {
  const normalizedId = String(subcategoryId || "").trim();
  if (!normalizedId) {
    return false;
  }

  const usageQuery = query(
    collection(db, TRANSACTIONS_COLLECTION),
    where("ownerUid", "==", requireCurrentUid(auth)),
    where("subcategoryId", "==", normalizedId),
    limit(1)
  );
  const snapshot = await getDocs(usageQuery);
  return !snapshot.empty;
}

export async function deleteSubcategoryPermanently(id) {
  return deleteDoc(doc(db, SUBCATEGORIES_COLLECTION, id));
}
