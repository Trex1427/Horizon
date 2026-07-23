import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";

const OBJECTIVES_COLLECTION = "objectives";

export function subscribeToObjectives(onData, onError) {
  return onSnapshot(
    query(collection(db, OBJECTIVES_COLLECTION), where("isActive", "==", true)),
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

export async function createObjective(payload) {
  return addDoc(collection(db, OBJECTIVES_COLLECTION), withOwnerUidForCreate({
    ...sanitizeUserPayload(payload, { removeSystemFields: true }),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateObjective(id, payload) {
  return updateDoc(doc(db, OBJECTIVES_COLLECTION, id), {
    ...sanitizeUserPayload(payload, { removeSystemFields: true }),
    updatedAt: new Date(),
  });
}

export async function deleteObjective(id) {
  // Soft delete
  return updateDoc(doc(db, OBJECTIVES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}

export async function updateObjectiveAmount(id, currentAmount) {
  return updateDoc(doc(db, OBJECTIVES_COLLECTION, id), {
    currentAmount,
    updatedAt: new Date(),
  });
}
