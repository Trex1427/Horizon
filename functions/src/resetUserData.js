import { HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_BATCH_SIZE = 400;

const FULL_RESET_COLLECTIONS = [
  "transactions",
  "accounts",
  "budgets",
  "fixedExpenses",
  "recurringIncome",
  "objectives",
  "vehicles",
  "workProjects",
  "workQuotes",
  "workInvoices",
  "professionalActivities",
  "debtsReceivables",
  "debtReceivablePayments",
  "opportunities",
  "transfers",
  "documents",
  "categories",
  "subcategories",
  "thirdParties",
  "activities",
  "projects",
  "bankImports",
  "receiptDrafts",
  "transactionDrafts",
];

const MODE_TO_COLLECTIONS = {
  transactions: ["transactions"],
  imports: ["bankImports"],
  full: FULL_RESET_COLLECTIONS,
};

function uniqueCollectionNames(names = []) {
  return Array.from(new Set((names || []).map((name) => String(name || "").trim()).filter(Boolean)));
}

function chunkRefs(refs = [], size = DEFAULT_BATCH_SIZE) {
  const chunks = [];

  for (let index = 0; index < refs.length; index += size) {
    chunks.push(refs.slice(index, index + size));
  }

  return chunks;
}

function createEmptyCollectionResult(collectionName) {
  return {
    collection: collectionName,
    scannedCount: 0,
    deletedCount: 0,
    error: null,
  };
}

function buildFinalSummary({ mode, requestedCollections, collectionResults, scanErrors, deleteErrors, preservedCollections }) {
  const perCollection = requestedCollections.reduce((accumulator, collectionName) => ({
    ...accumulator,
    [collectionName]: collectionResults[collectionName] || createEmptyCollectionResult(collectionName),
  }), {});

  const totals = Object.values(perCollection).reduce((accumulator, result) => ({
    scannedCount: accumulator.scannedCount + Number(result.scannedCount || 0),
    deletedCount: accumulator.deletedCount + Number(result.deletedCount || 0),
  }), {
    scannedCount: 0,
    deletedCount: 0,
  });

  const errors = [...scanErrors, ...deleteErrors];
  const hadErrors = errors.length > 0;

  return {
    mode,
    requestedCollections,
    deletedCollections: requestedCollections,
    preservedCollections,
    perCollection,
    totals,
    errors,
    hadErrors,
    isSuccess: !hadErrors,
  };
}

export async function resetUserDataCallable(request) {
  const ownerUid = String(request?.auth?.uid || "").trim();

  if (!ownerUid) {
    throw new HttpsError("unauthenticated", "Utilisateur Firebase requis.");
  }

  const payload = request?.data && typeof request.data === "object" ? request.data : {};
  const mode = String(payload.mode || "full");
  const additionalCollections = Array.isArray(payload.additionalCollections) ? payload.additionalCollections : [];
  const excludedCollections = Array.isArray(payload.excludedCollections) ? payload.excludedCollections : [];
  const batchSize = Number(payload.batchSize) > 0 ? Number(payload.batchSize) : DEFAULT_BATCH_SIZE;

  const baseCollections = MODE_TO_COLLECTIONS[mode] || MODE_TO_COLLECTIONS.full;
  const requestedCollections = uniqueCollectionNames([...baseCollections, ...additionalCollections]);
  const blockedCollections = new Set(uniqueCollectionNames(excludedCollections));
  const effectiveCollections = requestedCollections.filter((name) => !blockedCollections.has(name));

  const db = getFirestore();
  const collectionResults = {};
  const scanErrors = [];
  const deleteErrors = [];

  for (const collectionName of effectiveCollections) {
    collectionResults[collectionName] = createEmptyCollectionResult(collectionName);

    try {
      const snapshot = await db.collection(collectionName).where("ownerUid", "==", ownerUid).get();
      collectionResults[collectionName].refs = snapshot.docs.map((doc) => doc.ref);
      collectionResults[collectionName].scannedCount = snapshot.size;
    } catch (error) {
      const message = error?.message || `Erreur de scan pour ${collectionName}`;
      collectionResults[collectionName].error = message;
      scanErrors.push({ collection: collectionName, stage: "scan", message });
    }
  }

  for (const collectionName of effectiveCollections) {
    const result = collectionResults[collectionName];
    const refs = Array.isArray(result.refs) ? result.refs : [];

    if (result.error || refs.length === 0) {
      continue;
    }

    try {
      const chunks = chunkRefs(refs, batchSize);

      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();
        result.deletedCount += chunk.length;
      }
    } catch (error) {
      const message = error?.message || `Erreur de suppression pour ${collectionName}`;
      result.error = message;
      deleteErrors.push({ collection: collectionName, stage: "delete", message });
    }
  }

  return buildFinalSummary({
    mode,
    requestedCollections: effectiveCollections,
    collectionResults,
    scanErrors,
    deleteErrors,
    preservedCollections: Array.from(blockedCollections),
  });
}
