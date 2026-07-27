import {
  collection, doc, onSnapshot, query, updateDoc, where, writeBatch,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, db, storage } from "../firebase.js";
import { requireCurrentUid, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { normalizeQuote, normalizeQuoteForCreate, validatePdfFile, WORK_DOCUMENT_MAX_BYTES } from "../features/work/workModels.js";
import { cleanupOrphanQuotePdf } from "./orphanQuotePdfCleanupService.js";
import { commitFirestoreWithStorageCompensation } from "./firestoreCompensationCore.js";
import { uploadQuotePdf } from "./quotePdfUploadCore.js";

const MAX_DOCUMENT_BYTES = Number(import.meta.env.VITE_WORK_DOCUMENT_MAX_BYTES || WORK_DOCUMENT_MAX_BYTES);

const QUOTES = "workQuotes";
const DOCUMENTS = "documents";

export function subscribeToWorkQuotes(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(query(collection(db, QUOTES), where("ownerUid", "==", ownerUid)), (snapshot) => {
    onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((entry) => !entry.deletedAt)
      .sort((a, b) => String(b.issueDate || "").localeCompare(String(a.issueDate || ""))));
  }, onError);
}

export async function createWorkQuote(payload, pdfFile = null) {
  const ownerUid = requireCurrentUid(auth);
  const quoteRef = doc(collection(db, QUOTES));
  const documentRef = pdfFile ? doc(collection(db, DOCUMENTS)) : null;
  let documentPayload = null;
  let storagePath = "";

  if (pdfFile) {
    validatePdfFile(pdfFile, MAX_DOCUMENT_BYTES);
    const safeName = String(pdfFile.name || "devis.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");
    storagePath = `users/${ownerUid}/documents/quotes/${quoteRef.id}/${documentRef.id}-${safeName}`;
    await uploadQuotePdf(() => uploadBytes(ref(storage, storagePath), pdfFile, { contentType: "application/pdf" }));
    const now = new Date();
    documentPayload = withOwnerUidForCreate({
      entityType: "quote",
      entityId: quoteRef.id,
      documentType: "tiiime_quote",
      fileName: pdfFile.name,
      storagePath,
      mimeType: "application/pdf",
      fileSize: pdfFile.size,
      source: "upload",
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }, { auth });
  }

  const quotePayload = withOwnerUidForCreate(normalizeQuoteForCreate({
    ...payload,
    documentId: documentRef?.id || payload.documentId || null,
  }), { auth });
  const batch = writeBatch(db);
  if (documentRef) batch.set(documentRef, documentPayload);
  batch.set(quoteRef, quotePayload);
  return commitFirestoreWithStorageCompensation({
    commitFirestore: () => batch.commit(),
    storagePath,
    cleanupUploadedPdf: cleanupOrphanQuotePdf,
    successValue: { id: quoteRef.id, documentId: documentRef?.id || null },
  });
}

export function updateWorkQuote(id, payload) {
  return updateDoc(doc(db, QUOTES, id), normalizeQuote(payload));
}

export function archiveWorkQuote(id, documentId = null) {
  const now = new Date();
  const batch = writeBatch(db);
  batch.update(doc(db, QUOTES, id), { deletedAt: now, updatedAt: now });
  if (documentId) batch.update(doc(db, DOCUMENTS, documentId), { deletedAt: now, updatedAt: now });
  return batch.commit();
}

export async function openWorkQuoteDocument(document) {
  if (!document?.storagePath) throw new Error("PDF introuvable.");
  return getDownloadURL(ref(storage, document.storagePath));
}

export function subscribeToWorkDocuments(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(query(collection(db, DOCUMENTS), where("ownerUid", "==", ownerUid)), (snapshot) => {
    onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })).filter((entry) => !entry.deletedAt));
  }, onError);
}
