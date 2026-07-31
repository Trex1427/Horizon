import {
  collection, deleteField, doc, onSnapshot, query, runTransaction, serverTimestamp, setDoc, where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import {
  normalizeWorkInvoiceForCreate, sortWorkInvoices, validatePdfFile, WORK_DOCUMENT_MAX_BYTES,
} from "../features/work/workModels.js";
import { commitFirestoreWithStorageCompensation } from "./firestoreCompensationCore.js";
import { cleanupOrphanQuotePdf } from "./orphanQuotePdfCleanupService.js";

const INVOICES = "workInvoices";
const MAX_BYTES = Number(import.meta.env.VITE_WORK_DOCUMENT_MAX_BYTES || WORK_DOCUMENT_MAX_BYTES);

export function subscribeToWorkInvoices(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, INVOICES), where("ownerUid", "==", ownerUid)),
    (snapshot) => onData(sortWorkInvoices(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.isDeleted !== true))),
    onError,
  );
}

export async function importWorkInvoice(payload, pdfFile) {
  const ownerUid = requireCurrentUid(auth);
  validatePdfFile(pdfFile, MAX_BYTES);
  const invoiceRef = doc(collection(db, INVOICES));
  const safeName = String(pdfFile.name || "facture.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
  const pdfPath = `users/${ownerUid}/documents/invoices/${invoiceRef.id}/${safeName}`;
  await uploadBytes(ref(storage, pdfPath), pdfFile, { contentType: "application/pdf" });
  const invoice = withOwnerUidForCreate({
    id: invoiceRef.id,
    ...normalizeWorkInvoiceForCreate({ ...payload, source: "tiiime", status: "pending_payment", pdfPath }),
  }, { auth });
  return commitFirestoreWithStorageCompensation({
    commitFirestore: () => setDoc(invoiceRef, invoice),
    storagePath: pdfPath,
    cleanupUploadedPdf: cleanupOrphanQuotePdf,
    successValue: { id: invoiceRef.id, pdfPath },
    failureMessage: "L’enregistrement de la facture a échoué. Aucune facture n’a été créée.",
  });
}

export async function markWorkInvoicePaid(invoiceId) {
  const ownerUid = requireCurrentUid(auth);
  const invoiceRef = doc(db, INVOICES, invoiceId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(invoiceRef);
    if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid) throw new Error("Facture introuvable.");
    if (snapshot.data().status !== "pending_payment") {
      throw new Error("Seule une facture en attente peut être marquée payée.");
    }
    transaction.update(invoiceRef, { status: "paid", updatedAt: serverTimestamp() });
  });
}


export async function markWorkInvoicePending(invoiceId, { deleteLinkedTransaction = false } = {}) {
  const ownerUid = requireCurrentUid(auth);
  const invoiceRef = doc(db, INVOICES, invoiceId);
  return runTransaction(db, async (transaction) => {
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists() || invoiceSnapshot.data().ownerUid !== ownerUid) throw new Error("Facture introuvable.");
    const invoice = invoiceSnapshot.data();
    if (invoice.status !== "paid") throw new Error("Seule une facture payée peut être repassée en non payée.");

    const now = serverTimestamp();
    if (!invoice.paymentTransactionId) {
      transaction.update(invoiceRef, { status: "pending_payment", updatedAt: now });
      return { transactionKept: false, transactionDeleted: false };
    }
    if (!deleteLinkedTransaction) {
      transaction.update(invoiceRef, { status: "pending_payment", updatedAt: now });
      return { transactionKept: true, transactionDeleted: false };
    }

    const transactionRef = doc(db, "transactions", invoice.paymentTransactionId);
    const linkedSnapshot = await transaction.get(transactionRef);
    if (!linkedSnapshot.exists()) throw new Error("La transaction liée est introuvable. La facture n’a pas été modifiée.");
    const linkedPayment = linkedSnapshot.data();
    if (linkedPayment.ownerUid !== ownerUid || linkedPayment.workInvoiceId !== invoiceId || linkedPayment.isDeleted === true) {
      throw new Error("Le lien avec la transaction est incohérent. La facture n’a pas été modifiée.");
    }
    transaction.update(transactionRef, {
      workInvoiceId: deleteField(),
      isDeleted: true,
      deletedAt: now,
      deletedBy: ownerUid,
      updatedAt: now,
    });
    transaction.update(invoiceRef, {
      status: "pending_payment",
      paymentTransactionId: deleteField(),
      updatedAt: now,
    });
    return { transactionKept: false, transactionDeleted: true };
  });
}
export async function markWorkInvoicePaidWithTransaction(invoiceId, transactionPayload) {
  const ownerUid = requireCurrentUid(auth);
  const invoiceRef = doc(db, INVOICES, invoiceId);
  const transactionRef = doc(db, "transactions", `work-invoice-${invoiceId}`);
  return runTransaction(db, async (transaction) => {
    const invoiceSnapshot = await transaction.get(invoiceRef);
    if (!invoiceSnapshot.exists() || invoiceSnapshot.data().ownerUid !== ownerUid) throw new Error("Facture introuvable.");
    const invoice = invoiceSnapshot.data();
    if (invoice.paymentTransactionId) throw new Error("Une transaction est déjà liée à cette facture.");
    if (invoice.status !== "pending_payment") throw new Error("La facture n’est plus en attente de paiement.");
    const accountId = String(transactionPayload?.accountId || "").trim();
    if (!accountId) throw new Error("Le compte est obligatoire.");
    const account = await transaction.get(doc(db, "accounts", accountId));
    if (!account.exists() || account.data().ownerUid !== ownerUid || account.data().isActive === false) throw new Error("Compte introuvable.");
    const now = serverTimestamp();
    transaction.set(transactionRef, withOwnerUidForCreate({
      ...transactionPayload, type: "revenu", montant: Number(invoice.amountTTC || 0),
      thirdPartyId: invoice.thirdPartyId || null, workProjectId: invoice.workProjectId || null,
      workInvoiceId: invoiceId, destinationAccountId: null, createdAt: now, updatedAt: now, isDeleted: false,
    }, { auth }));
    transaction.update(invoiceRef, { status: "paid", paymentTransactionId: transactionRef.id, updatedAt: now });
    return { transactionId: transactionRef.id };
  });
}

export async function softDeleteWorkInvoice(invoiceId) {
  const ownerUid = requireCurrentUid(auth);
  const invoiceRef = doc(db, INVOICES, invoiceId);
  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(invoiceRef);
    if (!snapshot.exists() || snapshot.data().ownerUid !== ownerUid) throw new Error("Facture introuvable.");
    transaction.update(invoiceRef, { isDeleted: true, deletedAt: serverTimestamp(), deletedBy: ownerUid, updatedAt: serverTimestamp() });
    return { paymentTransactionId: snapshot.data().paymentTransactionId || null };
  });
}
export function openWorkInvoicePdf(invoice) {
  if (!invoice?.pdfPath) throw new Error("PDF introuvable.");
  return getDownloadURL(ref(storage, invoice.pdfPath));
}
