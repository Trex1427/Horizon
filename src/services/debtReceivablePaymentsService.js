import {
  collection,
  doc,
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

  if (!Number.isFinite(amount) || !Number.isFinite(cents) || cents <= 0) {
    throw new Error("Le montant du paiement doit etre strictement superieur a zero.");
  }

  if (!isValidDateString(paymentDate)) {
    throw new Error("La date de paiement est invalide.");
  }

  return {
    amount,
    amountCents: cents,
    paymentDate,
    note: noteRaw || null,
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

async function collectActivePayments(transaction, ownerUid, debtReceivableId) {
  const activePaymentsQuery = query(
    collection(db, DEBT_RECEIVABLE_PAYMENTS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("debtReceivableId", "==", debtReceivableId),
    where("isDeleted", "==", false),
  );
  const activePaymentsSnapshot = await transaction.get(activePaymentsQuery);
  return activePaymentsSnapshot.docs;
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

  return runPaymentMutationWithRetry(async () => {
    await runTransaction(db, async (transaction) => {
      const { snapshot: parentSnapshot, data: parentData } = await readOwnedActiveParent(transaction, parentRef, ownerUid);
      const parentAmountCents = normalizeParentAmountCents(parentData);
      const activePaymentDocs = await collectActivePayments(transaction, ownerUid, parentId);
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
        transactionId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDeleted: false,
      });

      transaction.update(parentRef, buildParentPaymentMutation(parentSnapshot, paymentRef.id));
    });

    return { id: paymentRef.id };
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
      const parentAmountCents = normalizeParentAmountCents(parentData);

      const activePaymentDocs = await collectActivePayments(transaction, ownerUid, parentId);
      const activePaidCents = activePaymentDocs.reduce((sum, paymentDoc) => {
        const cents = toCents(paymentDoc.data().amount);
        return sum + (Number.isFinite(cents) && cents > 0 ? cents : 0);
      }, 0);

      const currentPaymentCents = toCents(paymentData.amount) || 0;
      const candidatePaidCents = activePaidCents - currentPaymentCents + normalized.amountCents;
      if (candidatePaidCents > parentAmountCents) {
        throw new Error("Le total des paiements depasse le montant initial.");
      }

      transaction.update(paymentRef, {
        amount: normalized.amount,
        paymentDate: normalized.paymentDate,
        note: normalized.note,
        transactionId: null,
        updatedAt: serverTimestamp(),
      });

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

      transaction.update(paymentRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        transactionId: null,
      });

      transaction.update(parentRef, buildParentPaymentMutation(parentSnapshot, safePaymentId));
    });

    return { id: safePaymentId };
  });
}
