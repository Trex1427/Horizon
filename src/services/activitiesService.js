import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import {
  normalizeActivityPayload,
  normalizeActivityPayloadForCreate,
} from "./referencePayloadNormalizers.js";

const ACTIVITIES_COLLECTION = "activities";

export function subscribeToActivities(onData, onError, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? collection(db, ACTIVITIES_COLLECTION)
    : query(collection(db, ACTIVITIES_COLLECTION), where("isActive", "==", true));

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

export async function createActivity(payload) {
  return addDoc(collection(db, ACTIVITIES_COLLECTION), withOwnerUidForCreate(normalizeActivityPayloadForCreate(payload), { auth }));
}

export async function updateActivity(id, payload) {
  return updateDoc(doc(db, ACTIVITIES_COLLECTION, id), normalizeActivityPayload(payload));
}

export async function deleteActivity(id) {
  return updateDoc(doc(db, ACTIVITIES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}
