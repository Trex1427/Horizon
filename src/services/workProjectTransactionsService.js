import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid } from "../auth/requireCurrentUid.js";
import { normalizeTransactionRecord } from "../utils/transactionTypeUtils.js";

export function subscribeToLinkedWorkProjectTransactions(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  const linkedQuery = query(
    collection(db, "transactions"),
    where("ownerUid", "==", ownerUid),
    where("workProjectId", "!=", null),
  );
  return onSnapshot(linkedQuery, (snapshot) => {
    onData(snapshot.docs
      .map((entry) => normalizeTransactionRecord({ id: entry.id, ...entry.data() }))
      .filter((entry) => entry.isDeleted !== true));
  }, onError);
}