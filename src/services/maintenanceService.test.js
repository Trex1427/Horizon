import test from "node:test";
import assert from "node:assert/strict";
import { getMaintenanceCollectionsForMode, resetHorizonData } from "./maintenanceService.js";

const EXPECTED_FULL_COLLECTIONS = [
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

function createInMemoryTransport(initialState = {}, options = {}) {
  const store = Object.entries(initialState).reduce((accumulator, [collectionName, docs]) => ({
    ...accumulator,
    [collectionName]: new Set(docs || []),
  }), {});

  const failDeleteCollections = new Set(options.failDeleteCollections || []);

  function ensureCollection(collectionName) {
    if (!store[collectionName]) {
      store[collectionName] = new Set();
    }

    return store[collectionName];
  }

  return {
    getStoreSnapshot() {
      return Object.entries(store).reduce((accumulator, [collectionName, docs]) => ({
        ...accumulator,
        [collectionName]: Array.from(docs),
      }), {});
    },
    async listDocumentRefs(collectionName) {
      const docs = ensureCollection(collectionName);
      return Array.from(docs).map((id) => ({ collectionName, id }));
    },
    createBatch() {
      const refsToDelete = [];

      return {
        delete(ref) {
          refsToDelete.push(ref);
        },
        async commit() {
          if (refsToDelete.some((ref) => failDeleteCollections.has(ref.collectionName))) {
            throw new Error("delete failure");
          }

          refsToDelete.forEach((ref) => {
            ensureCollection(ref.collectionName).delete(ref.id);
          });
        },
      };
    },
  };
}

test("full reset removes targeted collections", async () => {
  const transport = createInMemoryTransport({
    transactions: ["t1", "t2", "t3"],
    accounts: ["a1", "a2"],
    budgets: ["b1"],
    fixedExpenses: ["f1"],
    recurringIncome: ["r1"],
    bankImports: ["i1", "i2"],
    transactionDrafts: ["d1"],
    objectives: ["o1"],
    categories: ["cat-system-1", "cat-system-2"],
  });

  const summary = await resetHorizonData({
    mode: "full",
    transport,
  });

  const snapshot = transport.getStoreSnapshot();

  assert.equal(summary.hadErrors, false);
  assert.equal(summary.isSuccess, true);
  assert.deepEqual(getMaintenanceCollectionsForMode("full"), EXPECTED_FULL_COLLECTIONS);
  assert.equal(summary.perCollection.transactions.deletedCount, 3);
  assert.equal(summary.perCollection.accounts.deletedCount, 2);
  assert.equal(summary.perCollection.budgets.deletedCount, 1);
  assert.equal(summary.perCollection.fixedExpenses.deletedCount, 1);
  assert.equal(summary.perCollection.recurringIncome.deletedCount, 1);
  assert.equal(summary.perCollection.objectives.deletedCount, 1);
  assert.equal(summary.perCollection.bankImports.deletedCount, 2);
  assert.equal(summary.perCollection.transactionDrafts.deletedCount, 1);

  assert.deepEqual(snapshot.fixedExpenses, []);
  assert.deepEqual(snapshot.recurringIncome, []);
  assert.deepEqual(snapshot.objectives, []);
  assert.deepEqual(snapshot.budgets, []);

  getMaintenanceCollectionsForMode("full").forEach((collectionName) => {
    assert.deepEqual(snapshot[collectionName] || [], []);
  });

  assert.deepEqual(summary.preservedCollections, []);
  assert.deepEqual(snapshot.categories, []);
});

test("full reset can preserve selected collections", async () => {
  const transport = createInMemoryTransport({
    transactions: ["t1"],
    categories: ["cat-system-1", "cat-system-2"],
    subcategories: ["sub-system-1"],
  });

  const summary = await resetHorizonData({
    mode: "full",
    excludedCollections: ["categories", "subcategories"],
    transport,
  });

  const snapshot = transport.getStoreSnapshot();

  assert.equal(summary.hadErrors, false);
  assert.deepEqual(summary.preservedCollections.sort(), ["categories", "subcategories"]);
  assert.deepEqual(snapshot.transactions, []);
  assert.deepEqual(snapshot.categories.sort(), ["cat-system-1", "cat-system-2"]);
  assert.deepEqual(snapshot.subcategories, ["sub-system-1"]);
});

test("summary reports errors and never marks global success when deletion fails", async () => {
  const transport = createInMemoryTransport(
    {
      transactions: ["t1"],
      bankImports: ["i1"],
      categories: ["cat-system-1"],
    },
    {
      failDeleteCollections: ["transactions"],
    }
  );

  const summary = await resetHorizonData({
    mode: "full",
    transport,
  });

  assert.equal(summary.hadErrors, true);
  assert.equal(summary.isSuccess, false);
  assert.equal(summary.errors.length > 0, true);
  assert.equal(summary.perCollection.transactions.error !== null, true);
  assert.equal(summary.perCollection.bankImports.deletedCount, 1);
});
