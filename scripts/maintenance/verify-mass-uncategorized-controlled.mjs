import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed, assertEmulatorWriteMode } from "../safety/automatedWriteGuard.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const TRANSACTIONS_COLLECTION = "transactions";
const TEST_NAME_PATTERNS = [/^UX2?\s/i, /^UI-MASS-TRACE-/i];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function createAdminDb() {
  const serviceAccountRaw = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(serviceAccountRaw);

  assertEmulatorWriteMode({ operationName: "maintenance:verify-mass-uncategorized-controlled" });
  assertAutomatedWriteAllowed({
    projectId: serviceAccount.project_id,
    operationName: "maintenance:verify-mass-uncategorized-controlled",
  });

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });

  return getFirestore(app);
}

function normalizeCategoryName(transaction = {}) {
  return String(transaction.categoryName || transaction.categorie || transaction.category || "").trim();
}

function readTransactionLabel(transaction = {}) {
  return String(
    transaction.label
      || transaction.libelle
      || transaction.description
      || transaction.name
      || ""
  ).trim();
}

function isExplicitTestTransaction(transaction = {}) {
  const label = readTransactionLabel(transaction);
  if (!label) {
    return false;
  }

  return TEST_NAME_PATTERNS.some((pattern) => pattern.test(label));
}

async function pickTwoCategorizedTransactions(db) {
  const snapshot = await db
    .collection(TRANSACTIONS_COLLECTION)
    .limit(300)
    .get();

  const candidates = snapshot.docs
    .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
    .filter((tx) => tx.isDeleted !== true)
    .filter((tx) => tx.type === "depense" || tx.type === "revenu")
    .filter((tx) => String(tx.categoryId || "").trim())
    .filter((tx) => isExplicitTestTransaction(tx));

  assert(candidates.length >= 2, "Impossible de trouver 2 transactions de test explicites (UX/UI-MASS-TRACE)");

  return candidates.slice(0, 2);
}

function classifyResult(result = {}) {
  return {
    updatedCount: Number(result.updatedCount || 0),
    failedCount: Number(result.failedCount || 0),
    failedIds: Array.isArray(result.failedIds) ? [...result.failedIds] : [],
  };
}

async function bulkUpdateTransactionsControlled(db, transactionIds, patch) {
  const ids = [...new Set(transactionIds.filter(Boolean))];
  const failedIds = [];
  let updatedCount = 0;

  if (!ids.length) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const batch = db.batch();
  ids.forEach((id) => {
    batch.update(db.collection(TRANSACTIONS_COLLECTION).doc(id), {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    updatedCount = ids.length;
  } catch {
    failedIds.push(...ids);
  }

  return {
    updatedCount,
    failedCount: failedIds.length,
    failedIds,
  };
}

async function bulkUpdateTransactionsByEntriesControlled(db, entries = []) {
  const normalizedEntries = entries
    .filter((entry) => entry && entry.id)
    .map((entry) => ({ id: entry.id, patch: entry.patch || {} }));

  if (!normalizedEntries.length) {
    return { updatedCount: 0, failedCount: 0, failedIds: [] };
  }

  const failedIds = [];
  let updatedCount = 0;
  const batch = db.batch();

  normalizedEntries.forEach((entry) => {
    batch.update(db.collection(TRANSACTIONS_COLLECTION).doc(entry.id), {
      ...entry.patch,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  try {
    await batch.commit();
    updatedCount = normalizedEntries.length;
  } catch {
    failedIds.push(...normalizedEntries.map((entry) => entry.id));
  }

  return {
    updatedCount,
    failedCount: failedIds.length,
    failedIds,
  };
}

async function readTransactionsByIds(db, ids) {
  const reads = await Promise.all(ids.map(async (id) => {
    const snap = await db.collection(TRANSACTIONS_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return { id, missing: true };
    }

    const data = snap.data();
    return {
      id,
      categoryId: String(data.categoryId || ""),
      categoryName: normalizeCategoryName(data),
      updatedAt: data.updatedAt || null,
    };
  }));

  return reads;
}

async function main() {
  const db = await createAdminDb();

  const initialTransactions = await pickTwoCategorizedTransactions(db);
  const initialSnapshot = initialTransactions.map((tx) => ({
    id: tx.id,
    categoryId: String(tx.categoryId || ""),
    categoryName: normalizeCategoryName(tx),
  }));

  const patchApplied = { categoryId: "" };
  const applyResultRaw = await bulkUpdateTransactionsControlled(
    db,
    initialTransactions.map((tx) => tx.id),
    patchApplied
  );
  const applyResult = classifyResult(applyResultRaw);

  const afterSnapshot = await readTransactionsByIds(
    db,
    initialTransactions.map((tx) => tx.id)
  );

  const revertResultRaw = await bulkUpdateTransactionsByEntriesControlled(
    db,
    initialSnapshot.map((tx) => ({
      id: tx.id,
      patch: {
        categoryId: tx.categoryId,
      },
    }))
  );

  const revertResult = classifyResult(revertResultRaw);
  const restoredSnapshot = await readTransactionsByIds(
    db,
    initialTransactions.map((tx) => tx.id)
  );

  const report = {
    patchApplied,
    before: initialSnapshot,
    after: afterSnapshot,
    applyResult,
    revertResult,
    restored: restoredSnapshot,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error("CONTROLLED_UNCATEGORIZED_TEST_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
