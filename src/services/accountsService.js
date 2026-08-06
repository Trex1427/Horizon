import { addDoc, collection, doc, getDocsFromServer, limit, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import {
  DEFAULT_ACCOUNT_NAME,
  hasAnyAccountDocumentsWithReader,
  initializeDefaultAccountsIfEmptyWithAdapter,
} from "./accountsDefaults";

const ACCOUNTS_COLLECTION = "accounts";
export { DEFAULT_ACCOUNT_NAME };

export function subscribeToAccounts(onData, onError, options = {}) {
  const ownerUid = options.ownerUid || requireCurrentUid(auth);
  console.log("QUERY ownerUid =", ownerUid);

  const queryFilters = {
    ownerUid,
    isActive: true,
    orderBy: null,
    where: [
      { field: "ownerUid", op: "==", value: ownerUid },
      { field: "isActive", op: "==", value: true },
    ],
  };
  console.log("QUERY details =", queryFilters);

  const accountsQuery = query(
    collection(db, ACCOUNTS_COLLECTION),
    where("ownerUid", "==", ownerUid)
  );

  return onSnapshot(
    accountsQuery,
    (snapshot) => {
      console.log("SNAPSHOT docs =", snapshot.size);
      console.log("SNAPSHOT raw docs =", snapshot.docs.map((d) => ({
        id: d.id,
        ownerUid: d.data().ownerUid,
        isActive: d.data().isActive,
        name: d.data().name,
      })));
      if (snapshot.size === 0) {
        console.error("AUCUN COMPTE RETOURNÉ PAR FIRESTORE");
      }

      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((left, right) => (left.displayOrder || 0) - (right.displayOrder || 0));

      console.log("DATA returned =", data);

      onData(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

export async function createAccount(payload) {
  return addDoc(collection(db, ACCOUNTS_COLLECTION), withOwnerUidForCreate(payload, { auth, removeSystemFields: true }));
}

export async function initializeDefaultAccountsIfEmpty(options = {}) {
  // Called by the authenticated user-environment bootstrap before subscriptions start.
  return initializeDefaultAccountsIfEmptyWithAdapter({
    hasAnyAccountDocuments,
    commitDefaultAccounts: async (documents) => {
      const batch = writeBatch(db);
      const ownerUid = requireCurrentUid(auth);

      for (const defaultAccount of documents) {
        batch.set(doc(db, ACCOUNTS_COLLECTION, `${ownerUid}_${defaultAccount.id}`), withOwnerUidForCreate(defaultAccount.data, { auth }));
      }

      await batch.commit();
    },
  }, options);
}

export async function updateAccount(id, payload) {
  return updateDoc(doc(db, ACCOUNTS_COLLECTION, id), {
    ...sanitizeUserPayload(payload, { removeSystemFields: true }),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteAccount(id) {
  return updateDoc(doc(db, ACCOUNTS_COLLECTION, id), {
    isActive: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function hasAnyAccountDocuments() {
  const ownerUid = requireCurrentUid(auth);
  return hasAnyAccountDocumentsWithReader(
    () => getDocsFromServer(query(collection(db, ACCOUNTS_COLLECTION), where("ownerUid", "==", ownerUid), limit(1)))
  );
}
