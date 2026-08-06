import { requireCurrentUid } from "../../../auth/requireCurrentUid.js";

const TRANSACTIONS_COLLECTION = "transactions";
export const HISTORICAL_SIMILARITY_LIMIT = 200;
const CLASSIFICATION_FIELDS = [
  "categoryId", "categoryName",
  "subcategoryId", "subcategoryName",
  "thirdPartyId", "thirdPartyName",
  "activityId", "activityName",
  "projectId", "projectName",
];

function mapHistoricalTransaction(transaction = {}) {
  const amount = Math.abs(Number(transaction.montant ?? transaction.amount ?? 0));
  return {
    ...transaction,
    historyTransactionId: transaction.id,
    sourceRowIndex: `history:${transaction.id}`,
    resultSource: "history",
    operationDate: transaction.date || transaction.operationDate || "",
    rawLabel: transaction.description || transaction.rawLabel || transaction.normalizedLabel || "",
    amount: transaction.type === "depense" ? -amount : amount,
  };
}

async function loadFirebaseContext() {
  const [{ collection, doc, getDocs, limit, query, where, writeBatch }, firebase] = await Promise.all([
    import("firebase/firestore"),
    import("../../../firebase.js"),
  ]);
  return { collection, doc, getDocs, limit, query, where, writeBatch, auth: firebase.auth, db: firebase.db };
}

async function createFirestoreTransport() {
  const { collection, doc, getDocs, limit, query, where, writeBatch, db } = await loadFirebaseContext();
  return {
    async search({ ownerUid, type, resultLimit }) {
      const constraints = [where("ownerUid", "==", ownerUid)];
      if (type) constraints.push(where("type", "==", type));
      constraints.push(limit(resultLimit));
      const snapshot = await getDocs(query(collection(db, TRANSACTIONS_COLLECTION), ...constraints));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    },
    async updateClassifications(ownerUid, updates) {
      const batch = writeBatch(db);
      updates.forEach(({ id, patch }) => batch.update(doc(db, TRANSACTIONS_COLLECTION, id), patch));
      await batch.commit();
    },
  };
}
export async function searchOwnedHistoricalTransactions(sourceRow = {}, options = {}) {
  const effectiveAuth = options.auth || (await loadFirebaseContext()).auth;
  const ownerUid = requireCurrentUid(effectiveAuth);
  const type = String(sourceRow.type || "").trim();
  const resultLimit = Math.min(Math.max(Number(options.resultLimit || HISTORICAL_SIMILARITY_LIMIT), 1), HISTORICAL_SIMILARITY_LIMIT);
  const cache = options.cache || new Map();
  const cacheKey = `${ownerUid}|${type || "all"}|${resultLimit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const transport = options.transport || await createFirestoreTransport();
  const pending = transport.search({ ownerUid, type, resultLimit }).then((transactions = []) => transactions
    .filter((transaction) => transaction.ownerUid === ownerUid)
    .filter((transaction) => transaction.isDeleted !== true)
    .map(mapHistoricalTransaction));
  cache.set(cacheKey, pending);
  try {
    return await pending;
  } catch (error) {
    cache.delete(cacheKey);
    throw error;
  }
}

export async function applyClassificationToOwnedHistory(sourceRow = {}, historicalRows = [], options = {}) {
  const effectiveAuth = options.auth || (await loadFirebaseContext()).auth;
  const ownerUid = requireCurrentUid(effectiveAuth);
  const patch = Object.fromEntries(CLASSIFICATION_FIELDS.map((field) => [field, sourceRow[field] ?? null]));
  const updates = historicalRows.map((row) => {
    if (!row.historyTransactionId || row.ownerUid !== ownerUid) {
      throw new Error("Transaction historique non autorisée.");
    }
    return { id: row.historyTransactionId, patch };
  });
  if (!updates.length) return 0;
  const transport = options.transport || await createFirestoreTransport();
  await transport.updateClassifications(ownerUid, updates);
  return updates.length;
}
