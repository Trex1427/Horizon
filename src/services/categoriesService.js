import { addDoc, collection, doc, getDocs, limit, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import { DEFAULT_CATEGORY_DEFINITIONS } from "../constants/categoryDefaults";

const CATEGORIES_COLLECTION = "categories";
let seedDefaultCategoriesPromise = null;

export function subscribeToCategories(onData, onError) {
  return onSnapshot(
    query(collection(db, CATEGORIES_COLLECTION), where("isActive", "==", true)),
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
  const anyCategorySnapshot = await getDocs(query(collection(db, CATEGORIES_COLLECTION), limit(1)));

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
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  return addDoc(collection(db, CATEGORIES_COLLECTION), withOwnerUidForCreate({
    name: safePayload.name?.trim() || "",
    type: safePayload.type || "depense",
    icon: safePayload.icon || "category",
    color: safePayload.color || "#2196F3",
    displayOrder: Number(safePayload.displayOrder || 0),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateCategory(id, payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  return updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
    name: safePayload.name?.trim() || "",
    type: safePayload.type || "depense",
    icon: safePayload.icon || "category",
    color: safePayload.color || "#2196F3",
    displayOrder: Number(safePayload.displayOrder || 0),
    updatedAt: new Date(),
  });
}

export async function deleteCategory(id) {
  return updateDoc(doc(db, CATEGORIES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}
