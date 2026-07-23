import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImportCommitPlan,
  commitValidatedBankImport,
  mapImportedTransactionToTransaction,
  mapImportedTransactionToTransfer,
} from "../services/importCommitService.js";

function createFakeTransport({ failOnBatch = -1 } = {}) {
  const writes = [];
  let batchIndex = 0;

  return {
    writes,
    auth: { currentUser: { uid: "uid-import-test" } },
    createCollectionRef: (name) => ({ name }),
    createDocRef: (collectionRef) => ({ id: `${collectionRef.name}-${writes.length + Math.random()}`, collection: collectionRef.name }),
    serverTimestamp: () => "SERVER_TIMESTAMP",
    createBatch: () => {
      const operations = [];
      const currentIndex = batchIndex;
      batchIndex += 1;

      return {
        set(ref, payload) {
          operations.push({ type: "set", ref, payload });
        },
        update(ref, payload) {
          operations.push({ type: "update", ref, payload });
        },
        async commit() {
          if (currentIndex === failOnBatch) {
            throw new Error("batch failure");
          }
          writes.push(...operations);
        },
      };
    },
  };
}

test("mapImportedTransactionToTransaction keeps category optional", () => {
  const transaction = mapImportedTransactionToTransaction({
    operationDate: "2026-01-05",
    amount: -82.43,
    type: "depense",
    rawLabel: "CB CARREFOUR VITROLLES",
    categoryId: null,
    categoryName: null,
    accountId: "acc-1",
    sourceFormat: "csv",
    fingerprint: "fp-1",
    bankReference: "REF1",
  }, { importId: "imp-1", importedAt: "SERVER_TIMESTAMP" });

  assert.equal(transaction.montant, 82.43);
  assert.equal(transaction.type, "depense");
  assert.equal(transaction.categoryId, null);
  assert.equal(transaction.subcategoryId, null);
  assert.equal(transaction.subcategoryName, null);
  assert.equal(transaction.activityId, null);
  assert.equal(transaction.activityName, null);
  assert.equal(transaction.thirdPartyId, null);
  assert.equal(transaction.thirdPartyName, null);
  assert.equal(transaction.projectId, null);
  assert.equal(transaction.projectName, null);
  assert.equal(transaction.importFormat, "csv");
  assert.equal(transaction.importBatchId, "imp-1");
  assert.equal(transaction.importSource, "bank_statement");
  assert.deepEqual(transaction.importOriginalSnapshot.categoryId, null);
});

test("mapImportedTransactionToTransaction keeps selected reference axes", () => {
  const transaction = mapImportedTransactionToTransaction({
    operationDate: "2026-07-11",
    amount: -55,
    type: "depense",
    rawLabel: "Plein",
    accountId: "acc-1",
    categoryId: "cat-transport",
    categoryName: "Transport",
    subcategoryId: "sub-carburant",
    subcategoryName: "Carburant",
    activityId: "act-auto",
    activityName: "Auto-entreprise",
    thirdPartyId: "tp-total",
    thirdPartyName: "TotalEnergies",
    projectId: "proj-monod",
    projectName: "Chantier Monod",
    sourceFormat: "csv",
    fingerprint: "fp-2",
  }, { importId: "imp-2", importedAt: "SERVER_TIMESTAMP" });

  assert.equal(transaction.subcategoryId, "sub-carburant");
  assert.equal(transaction.subcategoryName, "Carburant");
  assert.equal(transaction.activityId, "act-auto");
  assert.equal(transaction.thirdPartyId, "tp-total");
  assert.equal(transaction.projectId, "proj-monod");
});

test("buildImportCommitPlan splits batches below 500", () => {
  const rows = Array.from({ length: 501 }, (_, index) => ({ userDecision: "import", sourceRowIndex: index + 2 }));
  const plan = buildImportCommitPlan({ rows, fileName: "releve.csv", format: "csv", accountId: "acc-1" });

  assert.equal(plan.transactionChunks.length, 2);
  assert.equal(plan.transactionChunks[0].length < 500, true);
});

test("mapImportedTransactionToTransfer builds transfer payload only after explicit confirmation", () => {
  const transfer = mapImportedTransactionToTransfer({
    operationDate: "2026-07-11",
    amount: -500,
    transferSourceAccountId: "acc-1",
    transferDestinationAccountId: "acc-2",
    rawLabel: "VIREMENT INTERNE",
    transferCandidate: true,
    transferConfidence: 0.85,
    transferReasons: ["hint"],
  }, { importId: "imp-1", importedAt: "SERVER_TIMESTAMP" });

  assert.equal(transfer.amount, 500);
  assert.equal(transfer.sourceAccountId, "acc-1");
  assert.equal(transfer.destinationAccountId, "acc-2");
  assert.equal(transfer.transferConfirmed, true);
});

test("commitValidatedBankImport imports only validated rows and creates bank import journal", async () => {
  const transport = createFakeTransport();
  const result = await commitValidatedBankImport({
    rows: [
      { userDecision: "import", validationError: "", operationDate: "2026-01-05", amount: -10, type: "depense", rawLabel: "A", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-a", bankReference: "" },
      { userDecision: "skip", validationError: "", operationDate: "2026-01-05", amount: -20, type: "depense", rawLabel: "B", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-b", bankReference: "" },
    ],
    fileName: "releve.csv",
    format: "csv",
    accountId: "acc-1",
    transport,
  });

  assert.equal(result.importedCount, 1);
  assert.equal(transport.writes.every((entry) => entry.payload.ownerUid === "uid-import-test" || entry.type === "update"), true);
  assert.equal(String(result.importBatchId).startsWith("import-"), true);
  assert.equal(result.importedTransferCount, 0);
  assert.equal(result.skippedCount, 1);
  assert.equal(transport.writes.some((entry) => entry.ref.collection === "bankImports"), true);
  assert.equal(transport.writes.some((entry) => entry.payload?.fileContent), false);
  const transactionWrite = transport.writes.find((entry) => entry.ref.collection === "transactions");
  assert.equal(transactionWrite.payload.importBatchId, result.importBatchId);
  assert.equal(transactionWrite.payload.importFileName, "releve.csv");
  assert.equal(transactionWrite.payload.importAccountId, "acc-1");
});

test("commitValidatedBankImport records duplicate and suggestion counters in import journal", async () => {
  const transport = createFakeTransport();
  const result = await commitValidatedBankImport({
    rows: [
      { userDecision: "import", validationError: "", operationDate: "2026-01-05", amount: -10, type: "depense", rawLabel: "A", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-a", duplicateStatus: "new_transaction", classificationSuggestionApplied: true },
      { userDecision: "skip", validationError: "", operationDate: "2026-01-05", amount: -20, type: "depense", rawLabel: "B", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-b", duplicateStatus: "probable_duplicate", classificationSuggestionApplied: false },
    ],
    fileName: "same-day.csv",
    format: "csv",
    accountId: "acc-1",
    transport,
  });

  const finalImportWrite = [...transport.writes].reverse().find((entry) => entry.ref.collection === "bankImports");
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.suggestionAppliedCount, 1);
  assert.equal(finalImportWrite.payload.duplicateCount, 1);
  assert.equal(finalImportWrite.payload.suggestionAppliedCount, 1);
});

test("commitValidatedBankImport creates transfer docs only when candidate is confirmed", async () => {
  const transport = createFakeTransport();
  const result = await commitValidatedBankImport({
    rows: [
      {
        userDecision: "import",
        validationError: "",
        operationDate: "2026-01-05",
        amount: -500,
        type: "depense",
        rawLabel: "VIREMENT INTERNE",
        accountId: "acc-1",
        sourceFormat: "csv",
        fingerprint: "fp-transfer",
        bankReference: "",
        transferCandidate: true,
        transferConfirmed: true,
        transferSourceAccountId: "acc-1",
        transferDestinationAccountId: "acc-2",
      },
      {
        userDecision: "import",
        validationError: "",
        operationDate: "2026-01-05",
        amount: 1200,
        type: "revenu",
        rawLabel: "VIREMENT CLIENT",
        accountId: "acc-1",
        sourceFormat: "csv",
        fingerprint: "fp-income",
        bankReference: "",
        transferCandidate: true,
        transferConfirmed: false,
      },
    ],
    fileName: "releve.csv",
    format: "csv",
    accountId: "acc-1",
    transport,
  });

  assert.equal(result.importedCount, 1);
  assert.equal(result.importedTransferCount, 1);
  assert.equal(transport.writes.some((entry) => entry.ref.collection === "transfers"), true);
  assert.equal(transport.writes.some((entry) => entry.ref.collection === "transactions"), true);
});

test("commitValidatedBankImport reports batch failure", async () => {
  const transport = createFakeTransport({ failOnBatch: 2 });
  const rows = Array.from({ length: 450 }, (_, index) => ({
    userDecision: "import",
    validationError: "",
    operationDate: "2026-01-05",
    amount: -10,
    type: "depense",
    rawLabel: `ROW ${index}`,
    accountId: "acc-1",
    sourceFormat: "csv",
    fingerprint: `fp-${index}`,
    bankReference: "",
    sourceRowIndex: index + 2,
  }));

  const result = await commitValidatedBankImport({ rows, fileName: "releve.csv", format: "csv", accountId: "acc-1", transport });
  assert.equal(result.errorCount > 0, true);
  assert.equal(Array.isArray(result.failedRows), true);
});

test("two legitimate identical rows can still be imported after confirmation", async () => {
  const transport = createFakeTransport();
  const rows = [
    { userDecision: "import", validationError: "", operationDate: "2026-01-05", amount: -10, type: "depense", rawLabel: "A", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-1", bankReference: "REF" },
    { userDecision: "import", validationError: "", operationDate: "2026-01-05", amount: -10, type: "depense", rawLabel: "A", accountId: "acc-1", sourceFormat: "csv", fingerprint: "fp-1", bankReference: "REF" },
  ];

  const result = await commitValidatedBankImport({ rows, fileName: "releve.csv", format: "csv", accountId: "acc-1", transport });
  assert.equal(result.importedCount, 2);
});

test("future import suggestion can persist an explicit fixed-expense link without creating a template", () => {
  const transaction = mapImportedTransactionToTransaction({
    operationDate: "2026-08-10",
    amount: -57.25,
    type: "depense",
    rawLabel: "EDF",
    accountId: "acc-1",
    fixedExpenseId: "fixed-edf",
  });

  assert.equal(transaction.fixedExpenseId, "fixed-edf");
  assert.equal(transaction.isFixedExpense, true);
});
