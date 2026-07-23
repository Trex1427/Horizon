import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { buildOpportunityCreatePayload, buildOpportunityPayload } from "./opportunityPayloads.js";

const OPPORTUNITIES_COLLECTION = "opportunities";

export function subscribeToOpportunities(onData, onError, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? collection(db, OPPORTUNITIES_COLLECTION)
    : query(collection(db, OPPORTUNITIES_COLLECTION), where("isActive", "==", true));

  return onSnapshot(
    ref,
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
        .filter((opportunity) => opportunity.isDeleted !== true)
        .sort((left, right) => String(left.estimatedDate || "").localeCompare(String(right.estimatedDate || "")));

      onData(data);
    },
    (error) => onError?.(error)
  );
}

export async function createOpportunity(payload) {
  return addDoc(collection(db, OPPORTUNITIES_COLLECTION), withOwnerUidForCreate(buildOpportunityCreatePayload(payload), { auth }));
}

export async function updateOpportunity(id, payload) {
  return updateDoc(doc(db, OPPORTUNITIES_COLLECTION, id), buildOpportunityPayload(payload));
}

export async function setOpportunityActive(id, isActive) {
  return updateDoc(doc(db, OPPORTUNITIES_COLLECTION, id), {
    isActive: Boolean(isActive),
    updatedAt: new Date(),
  });
}

export async function deleteOpportunity(id) {
  return updateDoc(doc(db, OPPORTUNITIES_COLLECTION, id), {
    isDeleted: true,
    isActive: false,
    deletedAt: new Date(),
    updatedAt: new Date(),
  });
}
