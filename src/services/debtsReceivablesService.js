import { addDoc, collection, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { buildDebtReceivableCreatePayload, buildDebtReceivablePayload } from "./debtsReceivablesModel.js";

export const DEBTS_RECEIVABLES_COLLECTION = "debtsReceivables";

async function requireOwnedDocument(id) {
  const ownerUid = requireCurrentUid(auth);
  const reference = doc(db, DEBTS_RECEIVABLES_COLLECTION, id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid) {
    throw new Error("Élément introuvable ou accès refusé.");
  }
  return reference;
}

export function subscribeToDebtsReceivables(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  const reference = query(
    collection(db, DEBTS_RECEIVABLES_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("isDeleted", "==", false),
  );
  return onSnapshot(reference, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.isDeleted !== true)
      .sort((left, right) => {
        const dateOrder = String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"));
        return dateOrder || String(left.label || "").localeCompare(String(right.label || ""), "fr", { sensitivity: "base" }) || left.id.localeCompare(right.id);
      });
    onData(items);
  }, onError);
}

export function createDebtReceivable(payload) {
  requireCurrentUid(auth);
  return addDoc(
    collection(db, DEBTS_RECEIVABLES_COLLECTION),
    withOwnerUidForCreate(buildDebtReceivableCreatePayload(payload), { auth }),
  );
}

export async function updateDebtReceivable(id, payload) {
  const reference = await requireOwnedDocument(id);
  return updateDoc(reference, buildDebtReceivablePayload(payload));
}

export async function deleteDebtReceivable(id) {
  const reference = await requireOwnedDocument(id);
  return updateDoc(reference, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
}
