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
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import {
  normalizeSubcategoryPayloadForCreate,
  normalizeSubcategoryPayloadForUpdate,
} from "./referencePayloadNormalizers.js";

const SUBCATEGORIES_COLLECTION = "subcategories";
const TRANSACTIONS_COLLECTION = "transactions";

export function subscribeToSubcategories(onData, onError, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? collection(db, SUBCATEGORIES_COLLECTION)
    : query(collection(db, SUBCATEGORIES_COLLECTION), where("isActive", "==", true));

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
    where("subcategoryId", "==", normalizedId),
    limit(1)
  );
  const snapshot = await getDocs(usageQuery);
  return !snapshot.empty;
}

export async function deleteSubcategoryPermanently(id) {
  return deleteDoc(doc(db, SUBCATEGORIES_COLLECTION, id));
}
