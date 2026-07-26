import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid } from "../auth/requireCurrentUid.js";
import { isValidDateString } from "./debtsReceivablesModel.js";

export const DEBT_RECEIVABLE_PAYMENTS_COLLECTION = "debtReceivablePayments";
const DEBTS_RECEIVABLES_COLLECTION = "debtsReceivables";
const TRANSACTIONS_COLLECTION = "transactions";
const ACCOUNTS_COLLECTION = "accounts";
const THIRD_PARTIES_COLLECTION = "thirdParties";
const CATEGORIES_COLLECTION = "categories";
const MAX_PAYMENT_MUTATION_RETRIES = 3;

function toCents(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
}

function normalizePaymentInput(payload = {}) {
  const amount = Number(payload.amount);
  const cents = toCents(amount);
  const paymentDate = String(payload.paymentDate || "").trim();
  const noteRaw = String(payload.note || "").trim();
  const accountId = String(payload.accountId || "").trim();
  const label = String(payload.label || "").trim();

  if (!Number.isFinite(amount) || !Number.isFinite(cents) || cents <= 0) {
    throw new Error("Le montant du paiement doit etre strictement superieur a zero.");
  }

  if (!paymentDate || !isValidDateString(paymentDate)) {
    throw new Error("La date de paiement est invalide.");
  }
  if (!accountId) {
    throw new Error("Le compte bancaire est obligatoire.");
  }

  return {
    amount,
    amountCents: cents,
    paymentDate,
    note: noteRaw || null,
    accountId,
    label,
  };
}

async function readOwnedActiveAccount(transaction, accountId, ownerUid) {
  const accountSnapshot = await transaction.get(doc(db, ACCOUNTS_COLLECTION, accountId));
  if (!accountSnapshot.exists() || accountSnapshot.data().ownerUid !== ownerUid || accountSnapshot.data().isActive !== true) {
    throw new Error("Le compte bancaire selectionne est introuvable ou inactif.");
  }
}

async function readOwnedReference(transaction, collectionName, id, ownerUid, label) {
  const safeId = String(id || "").trim();
  if (!safeId) throw new Error(`${label} manquant sur la dette ou créance.`);
  const snapshot = await transaction.get(doc(db, collectionName, safeId));
  if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid || snapshot.data().isActive === false) {
    throw new Error(`${label} introuvable, inactif ou inaccessible.`);
  }
  return { id: safeId, ...snapshot.data() };
}

function buildLinkedTransaction(normalized, parentData, parentId, paymentId, ownerUid, thirdParty, category) {
  return {
    ownerUid,
    date: normalized.paymentDate,
    montant: normalized.amount,
    description: normalized.label || parentData.label || "Paiement dette / creance",
    type: parentData.type === "receivable" ? "revenu" : "depense",
    accountId: normalized.accountId,
    destinationAccountId: null,
    debtReceivableId: parentId,
    debtReceivablePaymentId: paymentId,
    thirdPartyId: thirdParty.id,
    thirdPartyName: thirdParty.name || "",
    categoryId: category.id,
    categoryName: category.name || "",
    categorie: category.name || "",
    isDeleted: false,
    updatedAt: serverTimestamp(),
  };
}
function normalizeParentAmountCents(parentData = {}) {
  const cents = toCents(parentData.amount);
  if (!Number.isFinite(cents) || cents <= 0) {
    throw new Error("Le montant de la dette ou creance est invalide.");
  }
  return cents;
}

function inferredPaymentsRevision(data = {}) {
  const revision = Number(data?.paymentsRevision);
  if (!Number.isFinite(revision) || revision < 0) return 0;
  return Math.floor(revision);
}

function isRetryableConflict(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  return code.includes("aborted") || message.includes("aborted") || message.includes("conflict");
}

async function runPaymentMutationWithRetry(mutation) {
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_PAYMENT_MUTATION_RETRIES; attempt += 1) {
    try {
      return await mutation();
    } catch (error) {
      lastError = error;
      if (!isRetryableConflict(error) || attempt >= MAX_PAYMENT_MUTATION_RETRIES) {
        break;
      }
    }
  }

  throw lastError || new Error("La mutation du paiement a echoue.");
}

async function readOwnedActiveParent(transaction, parentRef, ownerUid) {
  const parentSnapshot = await transaction.get(parentRef);
  if (!parentSnapshot.exists()) {
    throw new Error("Element parent introuvable.");
  }

  const parentData = parentSnapshot.data();
  if (parentData.ownerUid !== ownerUid) {
    throw new Error("Acces refuse au parent.");
  }
  if (parentData.isDeleted === true) {
    throw new Error("Le parent est supprime.");
  }

  return { snapshot: parentSnapshot, data: parentData };
}

function buildParentPaymentMutation(parentSnapshot, paymentId) {
  const parentData = parentSnapshot.data();
  const currentRevision = inferredPaymentsRevision(parentData);
  return {
    paymentsRevision: currentRevision + 1,
    paymentsMutationId: paymentId,
  };
}

async function collectActivePayments(ownerUid, debtReceivableId) {
  const activePaymentsQuery = query(
    collection(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("debtReceivableId", "==", debtReceivableId),
    where("isDeleted", "==", false),
  );
  const activePaymentsSnapshot = await getDocs(activePaymentsQuery);
  return activePaymentsSnapshot.docs;
}

async function readPaymentMutationBaseline(parentRef, ownerUid, debtReceivableId) {
  const parentSnapshot = await getDoc(parentRef);
  if (!parentSnapshot.exists()) throw new Error("Element parent introuvable.");
  const parentData = parentSnapshot.data();
  if (parentData.ownerUid !== ownerUid || parentData.isDeleted === true) {
    throw new Error("Acces refuse au parent ou parent supprime.");
  }
  const activePaymentDocs = await collectActivePayments(ownerUid, debtReceivableId);
  return { activePaymentDocs, paymentsRevision: inferredPaymentsRevision(parentData) };
}

function assertUnchangedPaymentBaseline(parentData, baseline) {
  if (inferredPaymentsRevision(parentData) !== baseline.paymentsRevision) {
    throw new Error("Conflict: les paiements ont change pendant l'enregistrement.");
  }
}

export function subscribeToActiveDebtReceivablePayments(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  const reference = query(
    collection(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("isDeleted", "==", false),
  );

  return onSnapshot(reference, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .filter((item) => item.isDeleted !== true);
    onData(items);
  }, onError);
}

export function subscribeToDebtReceivablePaymentsHistory(debtReceivableId, onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  const safeDebtReceivableId = String(debtReceivableId || "").trim();
  if (!safeDebtReceivableId) {
    onData([]);
    return () => {};
  }

  const reference = query(
    collection(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("debtReceivableId", "==", safeDebtReceivableId),
  );

  return onSnapshot(reference, (snapshot) => {
    const items = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() }))
      .sort((left, right) => {
        const dateOrder = String(right.paymentDate || "").localeCompare(String(left.paymentDate || ""));
        if (dateOrder) return dateOrder;
        const leftUpdatedAt = left.updatedAt?.seconds || 0;
        const rightUpdatedAt = right.updatedAt?.seconds || 0;
        if (rightUpdatedAt !== leftUpdatedAt) return rightUpdatedAt - leftUpdatedAt;
        return String(right.id || "").localeCompare(String(left.id || ""));
      });
    onData(items);
  }, onError);
}

export async function createDebtReceivablePayment(debtReceivableId, payload) {
  const ownerUid = requireCurrentUid(auth);
  const parentId = String(debtReceivableId || "").trim();
  if (!parentId) {
    throw new Error("Le parent du paiement est obligatoire.");
  }

  const normalized = normalizePaymentInput(payload);
  const parentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, parentId);
  const paymentRef = doc(collection(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION));
  const transactionRef = doc(collection(db, TRANSACTIONS_COLLECTION));

  return runPaymentMutationWithRetry(async () => {
    const baseline = await readPaymentMutationBaseline(parentRef, ownerUid, parentId);
    await runTransaction(db, async (transaction) => {
      const { snapshot: parentSnapshot, data: parentData } = await readOwnedActiveParent(transaction, parentRef, ownerUid);
      assertUnchangedPaymentBaseline(parentData, baseline);
      await readOwnedActiveAccount(transaction, normalized.accountId, ownerUid);
      const thirdParty = await readOwnedReference(transaction, THIRD_PARTIES_COLLECTION, parentData.thirdPartyId, ownerUid, "Le tiers");
      const category = await readOwnedReference(transaction, CATEGORIES_COLLECTION, parentData.categoryId, ownerUid, "La catégorie");
      const parentAmountCents = normalizeParentAmountCents(parentData);
      const activePaymentDocs = baseline.activePaymentDocs;
      const activePaidCents = activePaymentDocs.reduce((sum, paymentDoc) => {
        const cents = toCents(paymentDoc.data().amount);
        return sum + (Number.isFinite(cents) && cents > 0 ? cents : 0);
      }, 0);

      if (activePaidCents + normalized.amountCents > parentAmountCents) {
        throw new Error("Le total des paiements depasse le montant initial.");
      }

      transaction.set(paymentRef, {
        ownerUid,
        debtReceivableId: parentId,
        amount: normalized.amount,
        paymentDate: normalized.paymentDate,
        note: normalized.note,
        accountId: normalized.accountId,
        label: normalized.label || parentData.label || "",
        transactionId: transactionRef.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });

      transaction.set(transactionRef, {
        ...buildLinkedTransaction(normalized, parentData, parentId, paymentRef.id, ownerUid, thirdParty, category),
        createdAt: serverTimestamp(),
      });

      transaction.update(parentRef, buildParentPaymentMutation(parentSnapshot, paymentRef.id));
    });

    return { id: paymentRef.id, transactionId: transactionRef.id };
  });
}

export async function updateDebtReceivablePayment(paymentId, payload) {
  const ownerUid = requireCurrentUid(auth);
  const safePaymentId = String(paymentId || "").trim();
  if (!safePaymentId) {
    throw new Error("Le paiement est introuvable.");
  }

  const normalized = normalizePaymentInput(payload);
  const paymentRef = doc(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION, safePaymentId);

  return runPaymentMutationWithRetry(async () => {
    const paymentBeforeMutation = await getDoc(paymentRef);
    if (!paymentBeforeMutation.exists()) throw new Error("Paiement introuvable.");
    const baselineParentId = String(paymentBeforeMutation.data().debtReceivableId || "").trim();
    const baselineParentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, baselineParentId);
    const baseline = await readPaymentMutationBaseline(baselineParentRef, ownerUid, baselineParentId);
    await runTransaction(db, async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists()) {
        throw new Error("Paiement introuvable.");
      }

      const paymentData = paymentSnapshot.data();
      if (paymentData.ownerUid !== ownerUid) {
        throw new Error("Acces refuse au paiement.");
      }
      if (paymentData.isDeleted === true) {
        throw new Error("Un paiement supprime ne peut pas etre modifie.");
      }

      const parentId = String(paymentData.debtReceivableId || "").trim();
      const parentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, parentId);
      const { snapshot: parentSnapshot, data: parentData } = await readOwnedActiveParent(transaction, parentRef, ownerUid);
      if (parentId !== baselineParentId) throw new Error("Conflict: le parent du paiement a change.");
      assertUnchangedPaymentBaseline(parentData, baseline);
      await readOwnedActiveAccount(transaction, normalized.accountId, ownerUid);
      const thirdParty = await readOwnedReference(transaction, THIRD_PARTIES_COLLECTION, parentData.thirdPartyId, ownerUid, "Le tiers");
      const category = await readOwnedReference(transaction, CATEGORIES_COLLECTION, parentData.categoryId, ownerUid, "La catégorie");
      const parentAmountCents = normalizeParentAmountCents(parentData);

      const activePaymentDocs = baseline.activePaymentDocs;
      const activePaidCents = activePaymentDocs.reduce((sum, paymentDoc) => {
        const cents = toCents(paymentDoc.data().amount);
        return sum + (Number.isFinite(cents) && cents > 0 ? cents : 0);
      }, 0);

      const currentPaymentCents = toCents(paymentData.amount) || 0;
      const candidatePaidCents = activePaidCents - currentPaymentCents + normalized.amountCents;
      if (candidatePaidCents > parentAmountCents) {
        throw new Error("Le total des paiements depasse le montant initial.");
      }

      const existingTransactionId = String(paymentData.transactionId || "").trim();
      const transactionRef = existingTransactionId
        ? doc(db, TRANSACTIONS_COLLECTION, existingTransactionId)
        : doc(collection(db, TRANSACTIONS_COLLECTION));
      if (existingTransactionId) {
        const transactionSnapshot = await transaction.get(transactionRef);
        if (!transactionSnapshot.exists() || transactionSnapshot.data().ownerUid !== ownerUid) {
          throw new Error("La transaction liee au paiement est introuvable.");
        }
      }

      transaction.update(paymentRef, {
        amount: normalized.amount,
        paymentDate: normalized.paymentDate,
        note: normalized.note,
        accountId: normalized.accountId,
        label: normalized.label || parentData.label || "",
        transactionId: transactionRef.id,
        updatedAt: serverTimestamp(),
      });

      const linkedTransaction = buildLinkedTransaction(normalized, parentData, parentId, safePaymentId, ownerUid, thirdParty, category);
      if (existingTransactionId) {
        transaction.update(transactionRef, linkedTransaction);
      } else {
        transaction.set(transactionRef, { ...linkedTransaction, createdAt: serverTimestamp() });
      }

      transaction.update(parentRef, buildParentPaymentMutation(parentSnapshot, safePaymentId));
    });

    return { id: safePaymentId };
  });
}

export async function deleteDebtReceivablePayment(paymentId) {
  const ownerUid = requireCurrentUid(auth);
  const safePaymentId = String(paymentId || "").trim();
  if (!safePaymentId) {
    throw new Error("Le paiement est introuvable.");
  }

  const paymentRef = doc(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION, safePaymentId);

  return runPaymentMutationWithRetry(async () => {
    await runTransaction(db, async (transaction) => {
      const paymentSnapshot = await transaction.get(paymentRef);
      if (!paymentSnapshot.exists()) {
        throw new Error("Paiement introuvable.");
      }

      const paymentData = paymentSnapshot.data();
      if (paymentData.ownerUid !== ownerUid) {
        throw new Error("Acces refuse au paiement.");
      }
      if (paymentData.isDeleted === true) {
        throw new Error("Un paiement deja supprime ne peut pas etre modifie.");
      }

      const parentId = String(paymentData.debtReceivableId || "").trim();
      const parentRef = doc(db, DEBTS_RECEIVABLES_COLLECTION, parentId);
      const { snapshot: parentSnapshot } = await readOwnedActiveParent(transaction, parentRef, ownerUid);
      const transactionId = String(paymentData.transactionId || "").trim();
      const transactionRef = transactionId ? doc(db, TRANSACTIONS_COLLECTION, transactionId) : null;
      let transactionExists = false;
      if (transactionRef) {
        const transactionSnapshot = await transaction.get(transactionRef);
        transactionExists = transactionSnapshot.exists();
        if (transactionExists && transactionSnapshot.data().ownerUid !== ownerUid) {
          throw new Error("Acces refuse a la transaction liee au paiement.");
        }
      }

      transaction.update(paymentRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (transactionRef && transactionExists) {
        transaction.update(transactionRef, {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      transaction.update(parentRef, buildParentPaymentMutation(parentSnapshot, safePaymentId));
    });

    return { id: safePaymentId };
  });
}
