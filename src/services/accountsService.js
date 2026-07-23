import { addDoc, collection, doc, getDocsFromServer, limit, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import {
  DEFAULT_ACCOUNT_NAME,
  hasAnyAccountDocumentsWithReader,
  initializeDefaultAccountsIfEmptyWithAdapter,
} from "./accountsDefaults";

const ACCOUNTS_COLLECTION = "accounts";
export { DEFAULT_ACCOUNT_NAME };

export function subscribeToAccounts(onData, onError) {
  return onSnapshot(
    query(collection(db, ACCOUNTS_COLLECTION), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((left, right) => (left.displayOrder || 0) - (right.displayOrder || 0));

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
  // Explicit onboarding/admin action only. Never call this from a mount,
  // listener, snapshot callback, offline fallback, or other implicit flow.
  return initializeDefaultAccountsIfEmptyWithAdapter({
    hasAnyAccountDocuments,
    commitDefaultAccounts: async (documents) => {
      const batch = writeBatch(db);

      for (const defaultAccount of documents) {
        batch.set(doc(db, ACCOUNTS_COLLECTION, defaultAccount.id), withOwnerUidForCreate(defaultAccount.data, { auth }));
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
  return hasAnyAccountDocumentsWithReader(
    () => getDocsFromServer(query(collection(db, ACCOUNTS_COLLECTION), limit(1)))
  );
}
