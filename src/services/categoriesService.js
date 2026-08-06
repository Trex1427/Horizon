import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import { DEFAULT_CATEGORY_DEFINITIONS } from "../constants/categoryDefaults";

const CATEGORIES_COLLECTION = "categories";
let seedDefaultCategoriesPromise = null;

function normalizeCategoryName(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

async function assertNoActiveDuplicateCategory({ ownerUid, id = "", name = "", type = "depense" } = {}) {
  const normalized = normalizeCategoryName(name);
  if (!normalized) {
    throw new Error("Le nom de catégorie est requis");
  }

  const snapshot = await getDocs(query(
    collection(db, CATEGORIES_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("isActive", "==", true),
    where("type", "==", type)
  ));

  const conflict = snapshot.docs.find((entry) => {
    if (String(entry.id) === String(id || "")) return false;
    const data = entry.data() || {};
    const currentNormalized = normalizeCategoryName(data.nameNormalized || data.name);
    return currentNormalized === normalized;
  });

  if (conflict) {
    throw new Error("Une catégorie active avec ce nom existe déjà.");
  }
}

export function subscribeToCategories(onData, onError, options = {}) {
  const ownerUid = requireCurrentUid(auth);
  const includeInactive = options?.includeInactive === true;
  return onSnapshot(
    includeInactive
      ? query(collection(db, CATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid))
      : query(collection(db, CATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

      onData(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

export async function seedDefaultCategories() {
  if (seedDefaultCategoriesPromise) {
    return seedDefaultCategoriesPromise;
  }

  seedDefaultCategoriesPromise = (async () => {
  const ownerUid = requireCurrentUid(auth);
  const anyCategorySnapshot = await getDocs(query(collection(db, CATEGORIES_COLLECTION), where("ownerUid", "==", ownerUid), limit(1)));

  if (!anyCategorySnapshot.empty) {
    return { success: true, created: false };
  }

  const batchPromises = DEFAULT_CATEGORY_DEFINITIONS.map((category) =>
    addDoc(collection(db, CATEGORIES_COLLECTION), withOwnerUidForCreate({
      ...category,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { auth }))
  );

  await Promise.all(batchPromises);
  return { success: true, created: true };
  })();

  try {
    return await seedDefaultCategoriesPromise;
  } finally {
    seedDefaultCategoriesPromise = null;
  }
}

export async function createCategory(payload) {
  const ownerUid = requireCurrentUid(auth);
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const name = safePayload.name?.trim() || "";
  const type = safePayload.type || "depense";

  await assertNoActiveDuplicateCategory({ ownerUid, name, type });

  return addDoc(collection(db, CATEGORIES_COLLECTION), withOwnerUidForCreate({
    name,
    nameNormalized: normalizeCategoryName(name),
    type,
    icon: safePayload.icon || "category",
    color: safePayload.color || "#2196F3",
    displayOrder: Number(safePayload.displayOrder || 0),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateCategory(id, payload) {
  const ownerUid = requireCurrentUid(auth);
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const name = safePayload.name?.trim() || "";
  const type = safePayload.type || "depense";

  await assertNoActiveDuplicateCategory({ ownerUid, id, name, type });

  return updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
    name,
    nameNormalized: normalizeCategoryName(name),
    type,
    icon: safePayload.icon || "category",
    color: safePayload.color || "#2196F3",
    displayOrder: Number(safePayload.displayOrder || 0),
    ...(safePayload.isActive !== undefined ? { isActive: safePayload.isActive === true } : {}),
    updatedAt: new Date(),
  });
}

export async function deleteCategory(id) {
  return updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}
