import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import {
  buildBulkTransactionPatch,
  splitTransactionIdsIntoBatches,
  resolveBulkTransactionPatchForTransaction,
} from "./transactionBulkUpdateCore.js";
import { sanitizeUserPayload } from "../auth/requireCurrentUid.js";

const TRANSACTIONS_COLLECTION = "transactions";

function buildTransactionsByIdIndex(transactions = []) {
  return (transactions || []).reduce((map, transaction) => {
    if (transaction?.id) {
      map.set(transaction.id, transaction);
    }

    return map;
  }, new Map());
}

export async function bulkUpdateTransactions({
  transactionIds = [],
  patch = {},
  transactions = [],
  catalogs = {},
  clearIncompatibleSubcategories = false,
  batchSize = 450,
  dbInstance = db,
  batchFactory = writeBatch,
  docFactory = doc,
  collectionFactory = collection,
  timestampFactory = serverTimestamp,
} = {}) {
  const normalizedPatch = buildBulkTransactionPatch(sanitizeUserPayload(patch, { removeSystemFields: true }));
  const ids = Array.isArray(transactionIds) ? [...new Set(transactionIds.filter(Boolean))] : [];

  if (ids.length === 0) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const transactionsById = transactions instanceof Map ? transactions : buildTransactionsByIdIndex(transactions);
  const failedIds = new Set();
  const eligibleIds = [];

  ids.forEach((transactionId) => {
    const transaction = transactionsById.get(transactionId);
    if (!transaction) {
      failedIds.add(transactionId);
      return;
    }

    const resolution = resolveBulkTransactionPatchForTransaction(transaction, normalizedPatch, catalogs, {
      clearIncompatibleSubcategories,
    });

    if (!resolution.ok) {
      failedIds.add(transactionId);
      return;
    }

    eligibleIds.push({ transactionId, patch: resolution.patch });
  });

  const batches = splitTransactionIdsIntoBatches(eligibleIds, batchSize);
  let updatedCount = 0;

  for (const batchItems of batches) {
    if (batchItems.length === 0) {
      continue;
    }

    const batch = batchFactory(dbInstance);

    batchItems.forEach(({ transactionId, patch: transactionPatch }) => {
      batch.update(
        docFactory(collectionFactory(dbInstance, TRANSACTIONS_COLLECTION), transactionId),
        {
          ...transactionPatch,
          updatedAt: timestampFactory(),
        }
      );
    });

    try {
      await batch.commit();
      updatedCount += batchItems.length;
    } catch (error) {
      batchItems.forEach(({ transactionId }) => failedIds.add(transactionId));
    }
  }

  return {
    updatedCount,
    failedCount: failedIds.size,
    failedIds: [...failedIds],
  };
}

export async function bulkDeleteTransactions({
  transactionIds = [],
  dbInstance = db,
  batchFactory = writeBatch,
  docFactory = doc,
  collectionFactory = collection,
  timestampFactory = serverTimestamp,
  batchSize = 450,
} = {}) {
  const ids = Array.isArray(transactionIds) ? [...new Set(transactionIds.filter(Boolean))] : [];
  if (ids.length === 0) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const batches = splitTransactionIdsIntoBatches(ids, batchSize);
  const failedIds = new Set();
  let updatedCount = 0;

  for (const batchIds of batches) {
    const batch = batchFactory(dbInstance);

    batchIds.forEach((transactionId) => {
      batch.update(
        docFactory(collectionFactory(dbInstance, TRANSACTIONS_COLLECTION), transactionId),
        {
          isDeleted: true,
          deletedAt: timestampFactory(),
          updatedAt: timestampFactory(),
        }
      );
    });

    try {
      await batch.commit();
      updatedCount += batchIds.length;
    } catch (error) {
      batchIds.forEach((transactionId) => failedIds.add(transactionId));
    }
  }

  return {
    updatedCount,
    failedCount: failedIds.size,
    failedIds: [...failedIds],
  };
}
