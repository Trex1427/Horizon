import { collection, doc, getDocs, onSnapshot, query, serverTimestamp, where, writeBatch } from "firebase/firestore";

const BANK_IMPORTS_COLLECTION = "bankImports";
const TRANSACTIONS_COLLECTION = "transactions";
const SAFE_DELETE_BATCH_SIZE = 450;
const MODIFIED_FIELDS = [
  "date",
  "montant",
  "type",
  "description",
  "categoryId",
  "categoryName",
  "subcategoryId",
  "subcategoryName",
  "activityId",
  "activityName",
  "thirdPartyId",
  "thirdPartyName",
  "projectId",
  "projectName",
  "accountId",
  "fixedExpenseId",
  "isFixedExpense",
  "note",
  "notes",
];

function normalizeBatchId(importRecord = {}) {
  return String(importRecord.importBatchId || importRecord.importId || importRecord.id || "").trim();
}

function normalizeComparableValue(value) {
  if (value === undefined) {
    return null;
  }
  if (typeof value === "number") {
    return Number(value || 0);
  }
  if (typeof value === "boolean") {
    return Boolean(value);
  }
  return value === "" ? null : value ?? null;
}

export function isImportedTransactionModified(transaction = {}) {
  const snapshot = transaction.importOriginalSnapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  return MODIFIED_FIELDS.some((field) => (
    normalizeComparableValue(transaction[field]) !== normalizeComparableValue(snapshot[field])
  ));
}

function createFirestoreTransport(database) {
  return {
    createCollectionRef: (name) => collection(database, name),
    createDocRef: (collectionRef, id) => doc(collectionRef, id),
    createBatch: () => writeBatch(database),
    serverTimestamp: () => serverTimestamp(),
    async getTransactionsForImportBatch(importBatchId, legacyImportId = "") {
      const transactionsCollectionRef = collection(database, TRANSACTIONS_COLLECTION);
      const snapshots = await Promise.all([
        getDocs(query(transactionsCollectionRef, where("importBatchId", "==", importBatchId))),
        legacyImportId
          ? getDocs(query(transactionsCollectionRef, where("importId", "==", legacyImportId)))
          : Promise.resolve({ docs: [] }),
      ]);
      const documents = new Map();
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((docSnapshot) => {
          documents.set(docSnapshot.id, {
            id: docSnapshot.id,
            ref: docSnapshot.ref,
            data: docSnapshot.data(),
          });
        });
      });
      return [...documents.values()];
    },
  };
}

export function subscribeToBankImports(onData, onError) {
  let unsubscribe = null;
  let disposed = false;

  import("../../../firebase.js")
    .then(({ db }) => {
      if (disposed) {
        return;
      }

      unsubscribe = onSnapshot(
        collection(db, BANK_IMPORTS_COLLECTION),
        (snapshot) => {
          const data = snapshot.docs
            .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
            .sort((left, right) => String(right.completedAt || right.startedAt || "").localeCompare(String(left.completedAt || left.startedAt || "")));
          onData(data);
        },
        (error) => {
          onError?.(error);
        }
      );
    })
    .catch((error) => {
      onError?.(error);
    });

  return () => {
    disposed = true;
    unsubscribe?.();
  };
}

export function createBankImportDocRef() {
  throw new Error("createBankImportDocRef is not available synchronously; use import commit transport instead.");
}

export function getBankImportsCollectionName() {
  return BANK_IMPORTS_COLLECTION;
}

export function buildImportDeletionPlan({ importRecord = {}, transactionDocuments = [] } = {}) {
  const importBatchId = normalizeBatchId(importRecord);
  const legacyImportId = String(importRecord.importId || "").trim();
  const expectedCount = Number(importRecord.importedCount || 0);
  const safeDocuments = Array.isArray(transactionDocuments) ? transactionDocuments : [];
  const uniqueIds = new Set();
  const anomalies = [];

  if (!importBatchId) {
    anomalies.push("missing_import_batch_id");
  }

  safeDocuments.forEach((document) => {
    if (!document?.id || uniqueIds.has(document.id)) {
      anomalies.push("duplicate_transaction_id");
      return;
    }

    uniqueIds.add(document.id);
    const data = document.data || {};
    const belongsToBatch = data.importBatchId === importBatchId || (legacyImportId && data.importId === legacyImportId);
    if (!belongsToBatch) {
      anomalies.push("foreign_transaction_document");
    }
  });

  if (safeDocuments.length !== expectedCount) {
    anomalies.push("unexpected_transaction_count");
  }

  if (safeDocuments.length > SAFE_DELETE_BATCH_SIZE) {
    anomalies.push("delete_batch_too_large");
  }

  return {
    importBatchId,
    legacyImportId,
    expectedCount,
    actualCount: safeDocuments.length,
    transactionIds: [...uniqueIds],
    modifiedCount: safeDocuments.filter((document) => isImportedTransactionModified(document.data || {})).length,
    anomalies: [...new Set(anomalies)],
    canDelete: anomalies.length === 0,
  };
}

export function buildImportDeletionReport({ importRecord = {}, plan = {}, phase = "before", deletedCount = 0, remainingCount = 0, startedAt = "", finishedAt = "", error = "" } = {}) {
  return {
    phase,
    importBatchId: plan.importBatchId || normalizeBatchId(importRecord),
    importId: importRecord.importId || "",
    fileName: importRecord.fileName || importRecord.importFileName || "",
    accountId: importRecord.accountId || importRecord.importAccountId || "",
    expectedCount: plan.expectedCount ?? Number(importRecord.importedCount || 0),
    actualCount: plan.actualCount ?? 0,
    modifiedCount: plan.modifiedCount ?? 0,
    anomalies: plan.anomalies || [],
    deletedCount,
    remainingCount,
    startedAt,
    finishedAt,
    durationMs: startedAt && finishedAt ? Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()) : 0,
    error,
  };
}

export async function prepareBankImportDeletion(importRecord = {}, transport = null) {
  const effectiveTransport = transport || createFirestoreTransport((await import("../../../firebase.js")).db);
  const importBatchId = normalizeBatchId(importRecord);
  const legacyImportId = String(importRecord.importId || "").trim();
  const transactionDocuments = importBatchId
    ? await effectiveTransport.getTransactionsForImportBatch(importBatchId, legacyImportId)
    : [];
  const plan = buildImportDeletionPlan({ importRecord, transactionDocuments });

  return {
    plan,
    report: buildImportDeletionReport({
      importRecord,
      plan,
      phase: "before",
      remainingCount: plan.actualCount,
    }),
    transactionDocuments,
  };
}

export async function deleteBankImportBatch({ importRecord = {}, transport = null } = {}) {
  const effectiveTransport = transport || createFirestoreTransport((await import("../../../firebase.js")).db);
  const startedAt = new Date().toISOString();
  const preparation = await prepareBankImportDeletion(importRecord, effectiveTransport);
  const { plan, transactionDocuments } = preparation;

  if (!plan.canDelete) {
    return {
      success: false,
      deletedCount: 0,
      remainingCount: plan.actualCount,
      plan,
      report: buildImportDeletionReport({
        importRecord,
        plan,
        phase: "aborted",
        deletedCount: 0,
        remainingCount: plan.actualCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: plan.anomalies.join(", "),
      }),
    };
  }

  const bankImportsCollectionRef = effectiveTransport.createCollectionRef(BANK_IMPORTS_COLLECTION);
  const bankImportRef = effectiveTransport.createDocRef(bankImportsCollectionRef, importRecord.id || importRecord.importId || plan.importBatchId);
  const batch = effectiveTransport.createBatch();
  transactionDocuments.forEach((document) => {
    batch.delete(document.ref);
  });

  const reportDuring = buildImportDeletionReport({
    importRecord,
    plan,
    phase: "during",
    deletedCount: 0,
    remainingCount: plan.actualCount,
    startedAt,
  });

  batch.update(bankImportRef, {
    status: "deleted",
    deletedAt: effectiveTransport.serverTimestamp(),
    deletedCount: plan.actualCount,
    deletionReport: {
      before: preparation.report,
      during: reportDuring,
    },
  });

  try {
    await batch.commit();
  } catch (error) {
    return {
      success: false,
      deletedCount: 0,
      remainingCount: plan.actualCount,
      plan,
      report: buildImportDeletionReport({
        importRecord,
        plan,
        phase: "aborted",
        deletedCount: 0,
        remainingCount: plan.actualCount,
        startedAt,
        finishedAt: new Date().toISOString(),
        error: error?.message || "batch_delete_failed",
      }),
    };
  }

  const finishedAt = new Date().toISOString();
  const reportAfter = buildImportDeletionReport({
    importRecord,
    plan,
    phase: "after",
    deletedCount: plan.actualCount,
    remainingCount: 0,
    startedAt,
    finishedAt,
  });

  return {
    success: true,
    deletedCount: plan.actualCount,
    remainingCount: 0,
    plan,
    report: {
      importBatchId: plan.importBatchId,
      before: preparation.report,
      during: reportDuring,
      after: reportAfter,
      deletedCount: plan.actualCount,
      remainingCount: 0,
      durationMs: reportAfter.durationMs,
    },
  };
}
