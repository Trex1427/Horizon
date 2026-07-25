import { addDoc, collection, deleteField, doc, getDoc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { buildDebtReceivableCreatePayload, buildDebtReceivablePayload } from "./debtsReceivablesModel.js";

export const DEBTS_RECEIVABLES_COLLECTION = "debtsReceivables";
const THIRD_PARTIES_COLLECTION = "thirdParties";

async function requireOwnedDocument(id) {
  const ownerUid = requireCurrentUid(auth);
  const reference = doc(db, DEBTS_RECEIVABLES_COLLECTION, id);
  const snapshot = await getDoc(reference);
  if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid) {
    throw new Error("Élément introuvable ou accès refusé.");
  }
  return reference;
}

async function requireOwnedActiveThirdParty(thirdPartyId) {
  const ownerUid = requireCurrentUid(auth);
  const safeId = String(thirdPartyId || "").trim();
  if (!safeId) {
    throw new Error("Le tiers est obligatoire.");
  }

  const reference = doc(db, THIRD_PARTIES_COLLECTION, safeId);
  const snapshot = await getDoc(reference);
  const thirdParty = snapshot.exists() ? snapshot.data() : null;

  if (!thirdParty) {
    throw new Error("Tiers introuvable.");
  }

  if (thirdParty.ownerUid !== ownerUid) {
    throw new Error("Le tiers sélectionné n'appartient pas à l'utilisateur connecté.");
  }

  if (thirdParty.isActive === false) {
    throw new Error("Le tiers sélectionné est inactif.");
  }
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
  const normalized = buildDebtReceivableCreatePayload(payload);
  return requireOwnedActiveThirdParty(normalized.thirdPartyId).then(() => addDoc(
    collection(db, DEBTS_RECEIVABLES_COLLECTION),
    withOwnerUidForCreate(normalized, { auth }),
  ));
}

export async function updateDebtReceivable(id, payload) {
  const reference = await requireOwnedDocument(id);
  const normalized = buildDebtReceivablePayload(payload);
  await requireOwnedActiveThirdParty(normalized.thirdPartyId);
  return updateDoc(reference, {
    ...normalized,
    counterparty: deleteField(),
  });
}

export async function deleteDebtReceivable(id) {
  const reference = await requireOwnedDocument(id);
  return updateDoc(reference, { isDeleted: true, deletedAt: new Date(), updatedAt: new Date() });
}

export async function assertThirdPartyForDebtReceivable(thirdPartyId) {
  await requireOwnedActiveThirdParty(thirdPartyId);
}
