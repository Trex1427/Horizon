import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import { normalizeTransactionRecord, normalizeTransactionType } from "../utils/transactionTypeUtils.js";

const TRANSACTIONS_COLLECTION = "transactions";

function normalizeTransactionPayload(payload = {}) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const normalizedType = normalizeTransactionType(safePayload.type);
  if (!normalizedType) {
    throw new Error("Type de transaction invalide: seuls depense et revenu sont autorises.");
  }

  return {
    ...safePayload,
    type: normalizedType,
    subcategoryId: safePayload.subcategoryId || null,
    subcategoryName: safePayload.subcategoryName || null,
    activityId: safePayload.activityId || null,
    activityName: safePayload.activityName || null,
    thirdPartyId: safePayload.thirdPartyId || null,
    thirdPartyName: safePayload.thirdPartyName || null,
    projectId: safePayload.projectId || null,
    projectName: safePayload.projectName || null,
    workProjectId: safePayload.workProjectId || null,
    destinationAccountId: null,
  };
}

export function subscribeToTransactions(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, TRANSACTIONS_COLLECTION), where("ownerUid", "==", ownerUid)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => normalizeTransactionRecord({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .filter((transaction) => transaction.montant !== undefined)
        .filter((transaction) => transaction.isDeleted !== true);

      onData(data.reverse());
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

export async function createTransaction(payload) {
  return addDoc(collection(db, TRANSACTIONS_COLLECTION), withOwnerUidForCreate(normalizeTransactionPayload(payload), { auth }));
}

export async function updateTransaction(id, payload) {
  return updateDoc(doc(db, TRANSACTIONS_COLLECTION, id), normalizeTransactionPayload(payload));
}

export async function deleteTransaction(id) {
  return updateDoc(doc(db, TRANSACTIONS_COLLECTION, id), {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
  });
}
