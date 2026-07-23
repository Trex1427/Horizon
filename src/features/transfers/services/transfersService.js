import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../../../firebase";
import { requireCurrentUid, withOwnerUidForCreate } from "../../../auth/requireCurrentUid";
import {
  buildTransferCreatePayload,
  buildTransferDeletePatch,
  buildTransferUpdatePayload,
} from "../utils/transferPersistence";

const TRANSFERS_COLLECTION = "transfers";

export function subscribeToTransfers(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, TRANSFERS_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((left, right) => (right.date || "").localeCompare(left.date || ""));

      onData(data);
    },
    (error) => {
      onError?.(error);
    }
  );
}

export async function createTransfer(payload) {
  return addDoc(collection(db, TRANSFERS_COLLECTION), withOwnerUidForCreate(buildTransferCreatePayload(payload), { auth }));
}

export async function updateTransfer(id, payload) {
  return updateDoc(doc(db, TRANSFERS_COLLECTION, id), buildTransferUpdatePayload(payload));
}

export async function deleteTransfer(id) {
  return updateDoc(doc(db, TRANSFERS_COLLECTION, id), buildTransferDeletePatch());
}
