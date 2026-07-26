import { collection, deleteField, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid } from "../auth/requireCurrentUid.js";
import { buildDebtReceivableCreatePayload, buildDebtReceivablePayload } from "./debtsReceivablesModel.js";

export const DEBTS_RECEIVABLES_COLLECTION = "debtsReceivables";
const THIRD_PARTIES_COLLECTION = "thirdParties";
const CATEGORIES_COLLECTION = "categories";
const ACCOUNTS_COLLECTION = "accounts";
const TRANSACTIONS_COLLECTION = "transactions";

async function readOwnedReference(transaction, collectionName, id, ownerUid, label, expectedType = "") {
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error(`${label} obligatoire.`);
  const snapshot = await transaction.get(doc(db, collectionName, safeId));
  const value = snapshot.exists() ? snapshot.data() : null;
  if (!value || value.ownerUid !== ownerUid || value.isActive === false) throw new Error(`${label} introuvable, inactif ou inaccessible.`);
  if (expectedType && value.type && value.type !== expectedType) throw new Error(`${label} incompatible avec le type de transaction.`);
  return { id: safeId, ...value };
}

function buildInitialReceivableTransaction(parentId, normalized, ownerUid, thirdParty, category) {
  return {
    ownerUid,
    date: normalized.initialDate,
    montant: normalized.amount,
    description: normalized.label,
    type: "depense",
    accountId: normalized.initialAccountId,
    destinationAccountId: null,
    categoryId: category.id,
    categoryName: category.name || "",
    categorie: category.name || "",
    thirdPartyId: thirdParty.id,
    thirdPartyName: thirdParty.name || "",
    debtReceivableId: parentId,
    debtReceivableInitial: true,
    isDeleted: false,
    updatedAt: serverTimestamp(),
  };
}

async function readBusinessReferences(transaction, normalized, ownerUid) {
  const paymentType = normalized.type === "receivable" ? "revenu" : "depense";
  const thirdParty = await readOwnedReference(transaction, THIRD_PARTIES_COLLECTION, normalized.thirdPartyId, ownerUid, "Le tiers");
  await readOwnedReference(transaction, CATEGORIES_COLLECTION, normalized.categoryId, ownerUid, "La categorie des paiements", paymentType);
  if (normalized.type !== "receivable") return { thirdParty, initialCategory: null };
  const initialCategory = await readOwnedReference(transaction, CATEGORIES_COLLECTION, normalized.initialCategoryId, ownerUid, "La categorie de sortie", "depense");
  await readOwnedReference(transaction, ACCOUNTS_COLLECTION, normalized.initialAccountId, ownerUid, "Le compte de sortie");
  return { thirdParty, initialCategory };
}

export function subscribeToDebtsReceivables(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  const reference = query(collection(db, DEBTS_RECEIVABLES_COLLECTION), where("ownerUid", "==", ownerUid), where("isDeleted", "==", false));
  return onSnapshot(reference, (snapshot) => {
    const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.isDeleted !== true).sort((left, right) => {
      const dateOrder = String(left.dueDate || "9999-12-31").localeCompare(String(right.dueDate || "9999-12-31"));
      return dateOrder || String(left.label || "").localeCompare(String(right.label || ""), "fr", { sensitivity: "base" }) || left.id.localeCompare(right.id);
    });
    onData(items);
  }, onError);
}

export async function createDebtReceivable(payload) {
  const ownerUid = requireCurrentUid(auth);
  const normalized = buildDebtReceivableCreatePayload(payload);
  const parentRef = doc(collection(db, DEBTS_RECEIVABLES_COLLECTION));
  const initialTransactionRef = normalized.type === "receivable" ? doc(collection(db, TRANSACTIONS_COLLECTION)) : null;
  await runTransaction(db, async (transaction) => {
    const { thirdParty, initialCategory } = await readBusinessReferences(transaction, normalized, ownerUid);
    transaction.set(parentRef, {
      ...normalized,
      ownerUid,
      initialTransactionId: initialTransactionRef?.id || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (initialTransactionRef) transaction.set(initialTransactionRef, {
      ...buildInitialReceivableTransaction(parentRef.id, normalized, ownerUid, thirdParty, initialCategory),
      createdAt: serverTimestamp(),
    });
  });
  return { id: parentRef.id, initialTransactionId: initialTransactionRef?.id || null };
}

export async function updateDebtReceivable(id, payload) {
  const ownerUid = requireCurrentUid(auth);
  const normalized = buildDebtReceivablePayload(payload);
  const parentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, String(id || "").trim());
  const fallbackTransactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  await runTransaction(db, async (transaction) => {
    const parentSnapshot = await transaction.get(parentRef);
    if (!parentSnapshot.exists() || parentSnapshot.data().ownerUid !== ownerUid || parentSnapshot.data().isDeleted === true) throw new Error("Element introuvable ou acces refuse.");
    const parentData = parentSnapshot.data();
    const { thirdParty, initialCategory } = await readBusinessReferences(transaction, normalized, ownerUid);
    const existingInitialId = String(parentData.initialTransactionId || "").trim();
    const initialTransactionRef = existingInitialId ? doc(db, TRANSACTIONS_COLLECTION, existingInitialId) : fallbackTransactionRef;
    let existingInitialSnapshot = null;
    if (existingInitialId) {
      existingInitialSnapshot = await transaction.get(initialTransactionRef);
      if (existingInitialSnapshot.exists() && existingInitialSnapshot.data().ownerUid !== ownerUid) throw new Error("Acces refuse a la transaction initiale.");
    }
    const shouldHaveInitial = normalized.type === "receivable";
    transaction.update(parentRef, {
      ...normalized,
      counterparty: deleteField(),
      initialTransactionId: shouldHaveInitial ? initialTransactionRef.id : null,
      updatedAt: serverTimestamp(),
    });
    if (shouldHaveInitial) {
      const initialPayload = buildInitialReceivableTransaction(parentRef.id, normalized, ownerUid, thirdParty, initialCategory);
      if (existingInitialSnapshot?.exists()) transaction.update(initialTransactionRef, initialPayload);
      else transaction.set(initialTransactionRef, { ...initialPayload, createdAt: serverTimestamp() });
    } else if (existingInitialSnapshot?.exists()) {
      transaction.update(initialTransactionRef, { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    }
  });
  return { id: parentRef.id };
}

export async function deleteDebtReceivable(id) {
  const ownerUid = requireCurrentUid(auth);
  const parentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, String(id || "").trim());
  const activePayments = await getDocs(query(
    collection(db, "debtReceivablePayments"),
    where("ownerUid", "==", ownerUid),
    where("debtReceivableId", "==", parentRef.id),
    where("isDeleted", "==", false),
  ));
  if (!activePayments.empty) throw new Error("Supprimez d abord les paiements actifs de cet element.");
  await runTransaction(db, async (transaction) => {
    const parentSnapshot = await transaction.get(parentRef);
    if (!parentSnapshot.exists() || parentSnapshot.data().ownerUid !== ownerUid) throw new Error("Element introuvable ou acces refuse.");
    const initialId = String(parentSnapshot.data().initialTransactionId || "").trim();
    const initialRef = initialId ? doc(db, TRANSACTIONS_COLLECTION, initialId) : null;
    let initialSnapshot = null;
    if (initialRef) initialSnapshot = await transaction.get(initialRef);
    if (initialSnapshot?.exists() && initialSnapshot.data().ownerUid !== ownerUid) throw new Error("Acces refuse a la transaction initiale.");
    transaction.update(parentRef, { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
    if (initialSnapshot?.exists()) transaction.update(initialRef, { isDeleted: true, deletedAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return { id: parentRef.id };
}