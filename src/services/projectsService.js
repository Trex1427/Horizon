import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import {
  normalizeProjectPayload,
  normalizeProjectPayloadForCreate,
} from "./referencePayloadNormalizers.js";

const PROJECTS_COLLECTION = "projects";

export function subscribeToProjects(onData, onError, options = {}) {
  const includeInactive = options?.includeInactive === true;
  const ref = includeInactive
    ? collection(db, PROJECTS_COLLECTION)
    : query(collection(db, PROJECTS_COLLECTION), where("isActive", "==", true));

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

export async function createProject(payload) {
  return addDoc(collection(db, PROJECTS_COLLECTION), withOwnerUidForCreate(normalizeProjectPayloadForCreate(payload), { auth }));
}

export async function updateProject(id, payload) {
  return updateDoc(doc(db, PROJECTS_COLLECTION, id), normalizeProjectPayload(payload));
}

export async function deleteProject(id) {
  return updateDoc(doc(db, PROJECTS_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date().toISOString(),
  });
}
