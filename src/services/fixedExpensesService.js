import { collection, doc, getDocs, onSnapshot, query, runTransaction, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import {
  areFixedExpensesCompatible,
  buildFixedExpenseDocumentId,
} from "../utils/fixedExpenseIdentity.js";

const FIXED_EXPENSES_COLLECTION = "fixedExpenses";

export function subscribeToFixedExpenses(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, FIXED_EXPENSES_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      onData(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

function buildFixedExpenseCreatePayload(payload, now = new Date()) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return {
    ...safePayload,
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "monthly",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: safePayload.startDate || null,
    endDate: safePayload.endDate || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createFixedExpense(payload) {
  const documentPayload = withOwnerUidForCreate(buildFixedExpenseCreatePayload(payload), { auth });
  const activeSnapshot = await getDocs(query(
    collection(db, FIXED_EXPENSES_COLLECTION),
    where("ownerUid", "==", documentPayload.ownerUid),
    where("isActive", "==", true)
  ));
  const compatibleDocument = activeSnapshot.docs.find((snapshot) => areFixedExpensesCompatible(documentPayload, snapshot.data()));

  if (compatibleDocument) {
    const error = new Error("Une fiche de frais fixe compatible existe déjà. Associez la transaction à cette fiche.");
    error.code = "fixed-expense/already-exists";
    error.existingId = compatibleDocument.id;
    throw error;
  }

  const fixedExpenseRef = doc(collection(db, FIXED_EXPENSES_COLLECTION), buildFixedExpenseDocumentId(documentPayload));

  await runTransaction(db, async (transaction) => {
    const existingSnapshot = await transaction.get(fixedExpenseRef);
    if (existingSnapshot.exists()) {
      const error = new Error("Une création identique est déjà en cours ou terminée.");
      error.code = "fixed-expense/already-exists";
      error.existingId = fixedExpenseRef.id;
      throw error;
    }

    transaction.set(fixedExpenseRef, documentPayload);
  });

  return fixedExpenseRef;
}

export async function updateFixedExpense(id, payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return updateDoc(doc(db, FIXED_EXPENSES_COLLECTION, id), {
    ...safePayload,
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "monthly",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: safePayload.startDate || null,
    endDate: safePayload.endDate || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    updatedAt: new Date(),
  });
}

export async function deleteFixedExpense(id) {
  return updateDoc(doc(db, FIXED_EXPENSES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}
