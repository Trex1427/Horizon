import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import {
  normalizeThirdPartyPayload,
  normalizeThirdPartyPayloadForCreate,
} from "./referencePayloadNormalizers.js";

const THIRD_PARTIES_COLLECTION = "thirdParties";

export function subscribeToThirdParties(onData, onError, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? collection(db, THIRD_PARTIES_COLLECTION)
    : query(collection(db, THIRD_PARTIES_COLLECTION), where("isActive", "==", true));

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

export async function createThirdParty(payload) {
  return addDoc(collection(db, THIRD_PARTIES_COLLECTION), withOwnerUidForCreate(normalizeThirdPartyPayloadForCreate(payload), { auth }));
}

export async function updateThirdParty(id, payload) {
  return updateDoc(doc(db, THIRD_PARTIES_COLLECTION, id), normalizeThirdPartyPayload(payload));
}

export async function deleteThirdParty(id) {
  return updateDoc(doc(db, THIRD_PARTIES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}
