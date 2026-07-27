import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { normalizeProfessionalActivity, normalizeProfessionalActivityForCreate } from "../features/work/workModels.js";

const COLLECTION = "professionalActivities";

export function subscribeToProfessionalActivities(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(query(collection(db, COLLECTION), where("ownerUid", "==", ownerUid)), (snapshot) => {
    onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "fr")));
  }, onError);
}

export function createProfessionalActivity(payload) {
  return addDoc(collection(db, COLLECTION), withOwnerUidForCreate(normalizeProfessionalActivityForCreate(payload), { auth }));
}

export function updateProfessionalActivity(id, payload) {
  return updateDoc(doc(db, COLLECTION, id), normalizeProfessionalActivity(payload));
}

export function setProfessionalActivityActive(id, isActive) {
  return updateDoc(doc(db, COLLECTION, id), { isActive: Boolean(isActive), updatedAt: new Date() });
}
