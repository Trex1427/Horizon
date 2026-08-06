import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

const TRANSACTIONS_COLLECTION = "transactions";

function normalizeTransactionIds(transactionIds = []) {
  return [...new Set((Array.isArray(transactionIds) ? transactionIds : []).map((transactionId) => String(transactionId || "").trim()).filter(Boolean))];
}

function buildTransactionUpdatePayload(fixedExpenseId) {
  return {
    fixedExpenseId: fixedExpenseId || null,
    updatedAt: serverTimestamp(),
  };
}

export async function associateTransactionsWithFixedExpense({ transactionIds = [], fixedExpenseId = "", dbInstance = db, batchFactory = writeBatch, docFactory = doc, collectionFactory = collection } = {}) {
  const ids = normalizeTransactionIds(transactionIds);
  if (!ids.length || !String(fixedExpenseId || "").trim()) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const batch = batchFactory(dbInstance);
  ids.forEach((transactionId) => {
    batch.update(docFactory(collectionFactory(dbInstance, TRANSACTIONS_COLLECTION), transactionId), buildTransactionUpdatePayload(fixedExpenseId));
  });

  try {
    await batch.commit();
    return { updatedCount: ids.length, failedCount: 0, failedIds: [] };
  } catch {
    return { updatedCount: 0, failedCount: ids.length, failedIds: ids };
  }
}

export async function dissociateTransactionsFromFixedExpense({ transactionIds = [], dbInstance = db, batchFactory = writeBatch, docFactory = doc, collectionFactory = collection } = {}) {
  const ids = normalizeTransactionIds(transactionIds);
  if (!ids.length) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const batch = batchFactory(dbInstance);
  ids.forEach((transactionId) => {
    batch.update(docFactory(collectionFactory(dbInstance, TRANSACTIONS_COLLECTION), transactionId), buildTransactionUpdatePayload(""));
  });

  try {
    await batch.commit();
    return { updatedCount: ids.length, failedCount: 0, failedIds: [] };
  } catch {
    return { updatedCount: 0, failedCount: ids.length, failedIds: ids };
  }
}
