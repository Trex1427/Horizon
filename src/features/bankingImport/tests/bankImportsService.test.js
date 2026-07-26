import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportDeletionPlan,
  deleteBankImportBatch,
  isImportedTransactionModified,
  prepareBankImportDeletion,
} from "../services/bankImportsService.js";

function createTransactionDocument(id, data = {}) {
  return {
    id,
    ref: { collection: "transactions", id },
    data,
  };
}

function createImportRecord(overrides = {}) {
  return {
    id: "bank-import-1",
    importId: "import-20260715-183522-a8f4",
    importBatchId: "import-20260715-183522-a8f4",
    fileName: "releve.csv",
    accountId: "acc-1",
    importedCount: 2,
    duplicateCount: 0,
    status: "completed",
    ...overrides,
  };
}

function createFakeDeleteTransport({ documents = [], failCommit = false } = {}) {
  const operations = [];
  return {
    ownerUid: "owner-a",
    operations,
    createCollectionRef: (name) => ({ name }),
    createDocRef: (collectionRef, id) => ({ collection: collectionRef.name, id }),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    async getTransactionsForImportBatch() {
      return documents;
    },
    createBatch: () => ({
      delete(ref) {
        operations.push({ type: "delete", ref });
      },
      update(ref, payload) {
        operations.push({ type: "update", ref, payload });
      },
      async commit() {
        if (failCommit) {
          throw new Error("batch interrupted");
        }
      },
    }),
  };
}

function importedTransaction(batchId, overrides = {}) {
  const base = {
    importBatchId: batchId,
    importId: batchId,
    date: "2026-07-15",
    montant: 12,
    type: "depense",
    description: "A",
    categoryId: "cat-1",
    categoryName: "Courses",
    accountId: "acc-1",
    isFixedExpense: false,
    importOriginalSnapshot: {
      date: "2026-07-15",
      montant: 12,
      type: "depense",
      description: "A",
      categoryId: "cat-1",
      categoryName: "Courses",
      subcategoryId: null,
      subcategoryName: null,
      activityId: null,
      activityName: null,
      thirdPartyId: null,
      thirdPartyName: null,
      projectId: null,
      projectName: null,
      accountId: "acc-1",
      destinationAccountId: null,
      fixedExpenseId: null,
      isFixedExpense: false,
      note: "",
    },
  };
  return { ...base, ...overrides };
}

test("buildImportDeletionPlan accepts a simple import batch", () => {
  const importRecord = createImportRecord();
  const documents = [
    createTransactionDocument("t1", importedTransaction(importRecord.importBatchId)),
    createTransactionDocument("t2", importedTransaction(importRecord.importBatchId)),
  ];

  const plan = buildImportDeletionPlan({ importRecord, transactionDocuments: documents });
  assert.equal(plan.canDelete, true);
  assert.equal(plan.actualCount, 2);
  assert.deepEqual(plan.anomalies, []);
});

test("buildImportDeletionPlan separates several imports from the same day and same file", () => {
  const first = createImportRecord({ importBatchId: "import-20260715-183522-a8f4", importId: "import-20260715-183522-a8f4", fileName: "same.csv", importedCount: 1 });
  const second = createImportRecord({ importBatchId: "import-20260715-183523-bbbb", importId: "import-20260715-183523-bbbb", fileName: "same.csv", importedCount: 1 });
  const firstPlan = buildImportDeletionPlan({
    importRecord: first,
    transactionDocuments: [createTransactionDocument("t1", importedTransaction(first.importBatchId))],
  });
  const secondPlan = buildImportDeletionPlan({
    importRecord: second,
    transactionDocuments: [createTransactionDocument("t2", importedTransaction(second.importBatchId))],
  });

  assert.equal(firstPlan.canDelete, true);
  assert.equal(secondPlan.canDelete, true);
  assert.notEqual(firstPlan.importBatchId, secondPlan.importBatchId);
});

test("buildImportDeletionPlan blocks empty, foreign, duplicate, and unexpected batches", () => {
  const importRecord = createImportRecord({ importedCount: 1 });
  const emptyPlan = buildImportDeletionPlan({ importRecord, transactionDocuments: [] });
  const foreignPlan = buildImportDeletionPlan({
    importRecord,
    transactionDocuments: [createTransactionDocument("t1", importedTransaction("other-batch"))],
  });
  const duplicatePlan = buildImportDeletionPlan({
    importRecord: createImportRecord({ importedCount: 2 }),
    transactionDocuments: [
      createTransactionDocument("t1", importedTransaction(importRecord.importBatchId)),
      createTransactionDocument("t1", importedTransaction(importRecord.importBatchId)),
    ],
  });

  assert.equal(emptyPlan.canDelete, false);
  assert.equal(emptyPlan.anomalies.includes("unexpected_transaction_count"), true);
  assert.equal(foreignPlan.canDelete, false);
  assert.equal(foreignPlan.anomalies.includes("foreign_transaction_document"), true);
  assert.equal(duplicatePlan.canDelete, false);
  assert.equal(duplicatePlan.anomalies.includes("duplicate_transaction_id"), true);
});

test("isImportedTransactionModified detects post-import classification changes", () => {
  const untouched = importedTransaction("batch-1");
  const modified = importedTransaction("batch-1", { categoryId: "cat-2" });

  assert.equal(isImportedTransactionModified(untouched), false);
  assert.equal(isImportedTransactionModified(modified), true);
});

test("prepareBankImportDeletion reports modified transactions before confirmation", async () => {
  const importRecord = createImportRecord({ importedCount: 2 });
  const transport = createFakeDeleteTransport({
    documents: [
      createTransactionDocument("t1", importedTransaction(importRecord.importBatchId)),
      createTransactionDocument("t2", importedTransaction(importRecord.importBatchId, { thirdPartyId: "tp-2" })),
    ],
  });

  const preparation = await prepareBankImportDeletion(importRecord, transport);
  assert.equal(preparation.plan.canDelete, true);
  assert.equal(preparation.plan.modifiedCount, 1);
  assert.equal(preparation.report.phase, "before");
});

test("deleteBankImportBatch deletes only the selected batch and updates the journal atomically", async () => {
  const importRecord = createImportRecord({ importedCount: 2 });
  const transport = createFakeDeleteTransport({
    documents: [
      createTransactionDocument("t1", importedTransaction(importRecord.importBatchId)),
      createTransactionDocument("t2", importedTransaction(importRecord.importBatchId)),
    ],
  });

  const result = await deleteBankImportBatch({ importRecord, transport });
  assert.equal(result.success, true);
  assert.equal(result.deletedCount, 2);
  assert.equal(transport.operations.filter((operation) => operation.type === "delete").length, 2);
  assert.equal(transport.operations.some((operation) => operation.type === "update" && operation.payload.status === "deleted"), true);
  assert.equal(result.report.after.phase, "after");
  assert.equal(result.report.before.phase, "before");
  assert.equal(result.report.during.phase, "during");
});

test("deleteBankImportBatch aborts without delete when confirmation plan has anomalies", async () => {
  const importRecord = createImportRecord({ importedCount: 2 });
  const transport = createFakeDeleteTransport({
    documents: [createTransactionDocument("t1", importedTransaction(importRecord.importBatchId))],
  });

  const result = await deleteBankImportBatch({ importRecord, transport });
  assert.equal(result.success, false);
  assert.equal(transport.operations.filter((operation) => operation.type === "delete").length, 0);
  assert.equal(result.report.phase, "aborted");
});

test("deleteBankImportBatch reports an interrupted batch without claiming deletion", async () => {
  const importRecord = createImportRecord({ importedCount: 1 });
  const transport = createFakeDeleteTransport({
    failCommit: true,
    documents: [createTransactionDocument("t1", importedTransaction(importRecord.importBatchId))],
  });

  const result = await deleteBankImportBatch({ importRecord, transport });
  assert.equal(result.success, false);
  assert.equal(result.deletedCount, 0);
  assert.equal(result.report.error, "batch interrupted");
});
