import { collection, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { requireCurrentUid, sanitizeUserPayload } from "../../../auth/requireCurrentUid.js";

const TRANSACTIONS_COLLECTION = "transactions";
const BANK_IMPORTS_COLLECTION = "bankImports";
const TRANSFERS_COLLECTION = "transfers";
const SAFE_BATCH_SIZE = 400;

function createImportBatchId(date = new Date(), randomSource = Math.random) {
  const safeDate = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
  const stamp = [
    safeDate.getFullYear(),
    String(safeDate.getMonth() + 1).padStart(2, "0"),
    String(safeDate.getDate()).padStart(2, "0"),
  ].join("") + "-" + [
    String(safeDate.getHours()).padStart(2, "0"),
    String(safeDate.getMinutes()).padStart(2, "0"),
    String(safeDate.getSeconds()).padStart(2, "0"),
  ].join("");
  const suffix = Math.floor(randomSource() * 0xffff).toString(16).padStart(4, "0").slice(0, 4);
  return `import-${stamp}-${suffix}`;
}

function sanitizeImportFileName(fileName = "") {
  return String(fileName || "").split(/[\\/]/).pop() || "";
}

function chunkRows(rows = [], chunkSize = SAFE_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

export function mapImportedTransactionToTransaction(row = {}, { importId = "", importBatchId = "", importedAt = null, fileName = "", accountId = "", ownerUid = "" } = {}) {
  const safeRow = sanitizeUserPayload(row, { removeSystemFields: true });
  const fixedExpenseId = String(row.fixedExpenseId || "").trim() || null;
  const importFileName = sanitizeImportFileName(fileName || row.importFileName || "");
  const importAccountId = accountId || row.importAccountId || row.accountId || "";
  const transaction = {
    date: safeRow.operationDate,
    montant: Math.abs(Number(safeRow.amount || 0)),
    type: safeRow.type,
    description: safeRow.rawLabel || safeRow.normalizedLabel || "",
    categorie: safeRow.categoryName || "",
    categoryName: safeRow.categoryName || "",
    categoryId: safeRow.categoryId || null,
    subcategoryId: safeRow.subcategoryId || null,
    subcategoryName: safeRow.subcategoryName || null,
    activityId: safeRow.activityId || null,
    activityName: safeRow.activityName || null,
    thirdPartyId: safeRow.thirdPartyId || null,
    thirdPartyName: safeRow.thirdPartyName || null,
    projectId: safeRow.projectId || null,
    projectName: safeRow.projectName || null,
    accountId: safeRow.accountId || "",
    destinationAccountId: null,
    fixedExpenseId,
    isFixedExpense: Boolean(fixedExpenseId),
    importId,
    importBatchId: importBatchId || row.importBatchId || importId,
    importSource: "bank_statement",
    importFileName,
    importAccountId,
    importFormat: row.sourceFormat || "csv",
    importFingerprint: row.fingerprint || "",
    bankReference: row.bankReference || "",
    importedAt,
    createdAt: importedAt,
    ownerUid,
  };
  return {
    ...transaction,
    importOriginalSnapshot: buildImportedTransactionSnapshot(transaction),
  };
}

export function mapImportedTransactionToTransfer(row = {}, { importId = "", importBatchId = "", importedAt = null, fileName = "", accountId = "", ownerUid = "" } = {}) {
  const safeRow = sanitizeUserPayload(row, { removeSystemFields: true });
  return {
    date: safeRow.operationDate,
    amount: Math.abs(Number(safeRow.amount || 0)),
    sourceAccountId: safeRow.transferSourceAccountId || "",
    destinationAccountId: safeRow.transferDestinationAccountId || "",
    description: safeRow.rawLabel || safeRow.normalizedLabel || "",
    notes: `Import bancaire ${importId}`,
    importId,
    importBatchId: importBatchId || row.importBatchId || importId,
    importSource: "bank_statement",
    importFileName: sanitizeImportFileName(fileName || row.importFileName || ""),
    importAccountId: accountId || safeRow.importAccountId || safeRow.accountId || safeRow.transferSourceAccountId || "",
    importFormat: safeRow.sourceFormat || "csv",
    importFingerprint: safeRow.fingerprint || "",
    bankReference: safeRow.bankReference || "",
    transferCandidate: Boolean(safeRow.transferCandidate),
    transferConfidence: Number(safeRow.transferConfidence || 0),
    transferReasons: Array.isArray(safeRow.transferReasons) ? [...safeRow.transferReasons] : [],
    transferConfirmed: true,
    importedAt,
    createdAt: importedAt,
    isActive: true,
    ownerUid,
  };
}

export function buildImportedTransactionSnapshot(transaction = {}) {
  return {
    date: transaction.date || "",
    montant: Number(transaction.montant || 0),
    type: transaction.type || "",
    description: transaction.description || "",
    categoryId: transaction.categoryId || null,
    categoryName: transaction.categoryName || transaction.categorie || "",
    subcategoryId: transaction.subcategoryId || null,
    subcategoryName: transaction.subcategoryName || null,
    activityId: transaction.activityId || null,
    activityName: transaction.activityName || null,
    thirdPartyId: transaction.thirdPartyId || null,
    thirdPartyName: transaction.thirdPartyName || null,
    projectId: transaction.projectId || null,
    projectName: transaction.projectName || null,
    accountId: transaction.accountId || "",
    destinationAccountId: transaction.destinationAccountId || null,
    fixedExpenseId: transaction.fixedExpenseId || null,
    isFixedExpense: Boolean(transaction.isFixedExpense),
    note: transaction.note || transaction.notes || "",
  };
}

export function buildImportCommitPlan({ rows = [], fileName = "", format = "csv", sourceBank = null, accountId = "" } = {}) {
  const safeRows = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  const rowsToImport = safeRows.filter((row) => row.userDecision === "import" && !row.validationError);
  const rowsToTransfer = rowsToImport.filter((row) => (
    row.transferConfirmed === true &&
    String(row.transferSourceAccountId || "") &&
    String(row.transferDestinationAccountId || "") &&
    row.transferSourceAccountId !== row.transferDestinationAccountId
  ));
  const transferFingerprintSet = new Set(rowsToTransfer.map((row) => `${row.fingerprint || ""}:${row.sourceRowIndex || ""}`));
  const rowsToTransactions = rowsToImport.filter((row) => !transferFingerprintSet.has(`${row.fingerprint || ""}:${row.sourceRowIndex || ""}`));
  const skippedRows = safeRows.filter((row) => row.userDecision !== "import" || row.validationError);

  return {
    rowsToImport,
    rowsToTransactions,
    rowsToTransfer,
    skippedRows,
    fileName: sanitizeImportFileName(fileName),
    format,
    sourceBank,
    accountId,
    transactionChunks: chunkRows(rowsToTransactions),
    transferChunks: chunkRows(rowsToTransfer),
  };
}

function createFirestoreTransport(database) {
  return {
    createCollectionRef: (name) => collection(database, name),
    createDocRef: (collectionRef) => doc(collectionRef),
    createBatch: () => writeBatch(database),
    serverTimestamp: () => serverTimestamp(),
  };
}

function buildImportLogPayload({ importId = "", importBatchId = "", fileName = "", format = "csv", sourceBank = null, accountId = "", importedCount = 0, skippedCount = 0, duplicateCount = 0, suggestionAppliedCount = 0, ownerUid = "", errorCount = 0, status = "started", startedAt = null, completedAt = null } = {}) {
  return {
    importId,
    importBatchId: importBatchId || importId,
    fileName: sanitizeImportFileName(fileName),
    format,
    sourceBank,
    accountId,
    importFileName: sanitizeImportFileName(fileName),
    importAccountId: accountId,
    importSource: "bank_statement",
    importedCount,
    skippedCount,
    duplicateCount,
    suggestionAppliedCount,
    ownerUid,
    errorCount,
    startedAt,
    completedAt,
    status,
  };
}

export async function commitValidatedBankImport({ rows = [], fileName = "", format = "csv", sourceBank = null, accountId = "", transport = null, auth: authInstance = null } = {}) {
  let effectiveTransport = transport;
  let effectiveAuth = authInstance || effectiveTransport?.auth || null;

  if (!effectiveTransport) {
    const { auth, db } = await import("../../../firebase.js");
    effectiveTransport = createFirestoreTransport(db);
    effectiveAuth = auth;
  }

  const ownerUid = requireCurrentUid(effectiveAuth);
  const plan = buildImportCommitPlan({ rows, fileName, format, sourceBank, accountId });
  const transactionsCollectionRef = effectiveTransport.createCollectionRef(TRANSACTIONS_COLLECTION);
  const bankImportsCollectionRef = effectiveTransport.createCollectionRef(BANK_IMPORTS_COLLECTION);
  const transfersCollectionRef = effectiveTransport.createCollectionRef(TRANSFERS_COLLECTION);
  const bankImportRef = effectiveTransport.createDocRef(bankImportsCollectionRef);
  const importBatchId = createImportBatchId();
  const importId = importBatchId;
  const startedAt = effectiveTransport.serverTimestamp();
  const duplicateCount = rows.filter((row) => row.duplicateStatus !== "new_transaction").length;
  const suggestionAppliedCount = rows.filter((row) => row.classificationSuggestionApplied === true).length;

  if (plan.rowsToImport.length === 0) {
    const emptyBatch = effectiveTransport.createBatch();
    emptyBatch.set(bankImportRef, buildImportLogPayload({
      importId,
      importBatchId,
      fileName: plan.fileName,
      format: plan.format,
      sourceBank: plan.sourceBank,
      accountId: plan.accountId,
      importedCount: 0,
      skippedCount: plan.skippedRows.length,
      duplicateCount,
      suggestionAppliedCount,
      errorCount: 0,
      status: "completed",
      startedAt,
      completedAt: effectiveTransport.serverTimestamp(),
      ownerUid,
    }));
    await emptyBatch.commit();
    return {
      importId,
      importBatchId,
      importedCount: 0,
      importedTransferCount: 0,
      skippedCount: plan.skippedRows.length,
      duplicateCount,
      errorCount: 0,
      failedRows: [],
    };
  }

  const startBatch = effectiveTransport.createBatch();
  startBatch.set(bankImportRef, buildImportLogPayload({
    importId,
    importBatchId,
    fileName: plan.fileName,
    format: plan.format,
    sourceBank: plan.sourceBank,
    accountId: plan.accountId,
    importedCount: 0,
    skippedCount: plan.skippedRows.length,
    duplicateCount,
    suggestionAppliedCount,
    errorCount: 0,
    status: "started",
    startedAt,
    completedAt: null,
    ownerUid,
  }));
  await startBatch.commit();

  let importedCount = 0;
  let importedTransferCount = 0;
  const failedRows = [];

  try {
    for (const chunk of plan.transactionChunks) {
      const batch = effectiveTransport.createBatch();
      chunk.forEach((row) => {
        const transactionRef = effectiveTransport.createDocRef(transactionsCollectionRef);
        batch.set(transactionRef, mapImportedTransactionToTransaction(row, {
          importId,
          importedAt: effectiveTransport.serverTimestamp(),
          importBatchId,
          fileName: plan.fileName,
          accountId: plan.accountId,
          ownerUid,
        }));
      });
      await batch.commit();
      importedCount += chunk.length;
    }

    for (const chunk of plan.transferChunks) {
      const batch = effectiveTransport.createBatch();
      chunk.forEach((row) => {
        const transferRef = effectiveTransport.createDocRef(transfersCollectionRef);
        batch.set(transferRef, mapImportedTransactionToTransfer(row, {
          importId,
          importedAt: effectiveTransport.serverTimestamp(),
          importBatchId,
          fileName: plan.fileName,
          accountId: plan.accountId,
          ownerUid,
        }));
      });
      await batch.commit();
      importedTransferCount += chunk.length;
    }

    const finishBatch = effectiveTransport.createBatch();
    finishBatch.update(bankImportRef, buildImportLogPayload({
      importId,
      importBatchId,
      fileName: plan.fileName,
      format: plan.format,
      sourceBank: plan.sourceBank,
      accountId: plan.accountId,
      importedCount,
      skippedCount: plan.skippedRows.length,
      duplicateCount,
      suggestionAppliedCount,
      errorCount: 0,
      status: "completed",
      startedAt,
      completedAt: effectiveTransport.serverTimestamp(),
      ownerUid,
    }));
    await finishBatch.commit();
  } catch {
    failedRows.push(...plan.rowsToImport.slice(importedCount + importedTransferCount).map((row) => row.sourceRowIndex));
    const failureBatch = effectiveTransport.createBatch();
    failureBatch.update(bankImportRef, {
      ...buildImportLogPayload({
        importId,
        importBatchId,
        fileName: plan.fileName,
        format: plan.format,
        sourceBank: plan.sourceBank,
        accountId: plan.accountId,
        importedCount,
        skippedCount: plan.skippedRows.length,
        duplicateCount,
        suggestionAppliedCount,
        errorCount: failedRows.length || 1,
        status: importedCount > 0 ? "partial_failure" : "failed",
        startedAt,
        completedAt: effectiveTransport.serverTimestamp(),
        ownerUid,
      }),
      failedRows,
    });
    await failureBatch.commit();
    return {
      importId,
      importedCount,
      importedTransferCount,
      skippedCount: plan.skippedRows.length,
      duplicateCount,
      errorCount: failedRows.length || 1,
      failedRows,
    };
  }

  return {
    importId,
    importBatchId,
    importedCount,
    importedTransferCount,
    skippedCount: plan.skippedRows.length,
    duplicateCount,
    suggestionAppliedCount,
    errorCount: 0,
    failedRows,
  };
}
