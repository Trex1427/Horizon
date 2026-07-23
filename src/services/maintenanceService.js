import { collection, getDocs, writeBatch } from "firebase/firestore";

const DEFAULT_BATCH_SIZE = 400;

const FULL_RESET_COLLECTIONS = [
  "transactions",
  "accounts",
  "budgets",
  "fixedExpenses",
  "recurringIncome",
  "objectives",
  "bankImports",
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

async function buildDefaultTransport() {
  const { db } = await import("../firebase.js");

  return {
    async listDocumentRefs(collectionName) {
      const snapshot = await getDocs(collection(db, collectionName));
      return snapshot.docs.map((docSnapshot) => docSnapshot.ref);
    },
    createBatch() {
      return writeBatch(db);
    },
  };
}

function createEmptyCollectionResult(collectionName) {
  return {
    collection: collectionName,
    scannedCount: 0,
    deletedCount: 0,
    error: null,
  };
}

function buildFinalSummary({ mode, requestedCollections, collectionResults, scanErrors, deleteErrors }) {
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
    preservedCollections: ["categories", "settings", "preferences", "theme", "version"],
    perCollection,
    totals,
    errors,
    hadErrors,
    isSuccess: !hadErrors,
  };
}

export function getMaintenanceCollectionsForMode(mode = "full") {
  return MODE_TO_COLLECTIONS[mode] || MODE_TO_COLLECTIONS.full;
}

export async function resetHorizonData({
  mode = "full",
  additionalCollections = [],
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress,
  transport,
} = {}) {
  const baseCollections = getMaintenanceCollectionsForMode(mode);
  const requestedCollections = uniqueCollectionNames([...baseCollections, ...additionalCollections]);
  const effectiveTransport = transport || await buildDefaultTransport();

  const collectionResults = {};
  const scanErrors = [];
  const deleteErrors = [];
  let globalTotalToDelete = 0;

  onProgress?.({
    phase: "scan-start",
    mode,
    totalCollections: requestedCollections.length,
  });

  for (const collectionName of requestedCollections) {
    collectionResults[collectionName] = createEmptyCollectionResult(collectionName);

    try {
      const refs = await effectiveTransport.listDocumentRefs(collectionName);
      collectionResults[collectionName].refs = refs;
      collectionResults[collectionName].scannedCount = refs.length;
      globalTotalToDelete += refs.length;

      onProgress?.({
        phase: "scan-collection",
        mode,
        collection: collectionName,
        scannedCount: refs.length,
        totalToDelete: globalTotalToDelete,
      });
    } catch (error) {
      const message = error?.message || `Erreur de scan pour ${collectionName}`;
      collectionResults[collectionName].error = message;
      scanErrors.push({ collection: collectionName, stage: "scan", message });

      onProgress?.({
        phase: "scan-error",
        mode,
        collection: collectionName,
        message,
      });
    }
  }

  let globalDeletedCount = 0;

  for (const collectionName of requestedCollections) {
    const result = collectionResults[collectionName];
    const refs = Array.isArray(result.refs) ? result.refs : [];

    if (result.error || refs.length === 0) {
      continue;
    }

    try {
      const refChunks = chunkRefs(refs, batchSize);

      for (const chunk of refChunks) {
        const batch = effectiveTransport.createBatch();
        chunk.forEach((ref) => batch.delete(ref));
        await batch.commit();

        result.deletedCount += chunk.length;
        globalDeletedCount += chunk.length;

        onProgress?.({
          phase: "delete-collection",
          mode,
          collection: collectionName,
          deletedInCollection: result.deletedCount,
          scannedInCollection: result.scannedCount,
          deletedOverall: globalDeletedCount,
          totalToDelete: globalTotalToDelete,
        });
      }
    } catch (error) {
      const message = error?.message || `Erreur de suppression pour ${collectionName}`;
      result.error = message;
      deleteErrors.push({ collection: collectionName, stage: "delete", message });

      onProgress?.({
        phase: "delete-error",
        mode,
        collection: collectionName,
        message,
      });
    }
  }

  const summary = buildFinalSummary({
    mode,
    requestedCollections,
    collectionResults,
    scanErrors,
    deleteErrors,
  });

  onProgress?.({
    phase: "done",
    mode,
    summary,
  });

  return summary;
}

export async function exportHorizonDataPlaceholder() {
  return {
    success: false,
    placeholder: true,
    message: "Export de donnees bientot disponible.",
  };
}

export async function importHorizonBackupPlaceholder() {
  return {
    success: false,
    placeholder: true,
    message: "Import de sauvegarde bientot disponible.",
  };
}
