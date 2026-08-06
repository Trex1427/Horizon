import test from "node:test";
import assert from "node:assert/strict";
import { runMigrationWithBackend } from "./migrate-reset-category-references.mjs";

class InMemoryBackend {
  constructor(seedDocuments = [], options = {}) {
    this.documents = new Map(seedDocuments.map((document) => [document.path, clone(document)]));
    this.failOnCommitNumber = Number.isInteger(options.failOnCommitNumber) ? options.failOnCommitNumber : null;
    this.commitCount = 0;
  }

  async scanAllDocuments() {
    return [...this.documents.values()]
      .map((document) => ({
        path: document.path,
        id: parseDocumentId(document.path),
        collectionPath: parseCollectionPathFromDocumentPath(document.path),
        collectionId: parseCollectionIdFromDocumentPath(document.path),
        data: clone(document.data),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  async commitBatch(operations = []) {
    this.commitCount += 1;

    if (this.failOnCommitNumber !== null && this.commitCount === this.failOnCommitNumber) {
      throw new Error(`Simulated interruption at commit ${this.commitCount}`);
    }

    for (const operation of operations) {
      const current = this.documents.get(operation.path);
      if (operation.type === "update") {
        if (!current) {
          throw new Error(`Missing document for update: ${operation.path}`);
        }
        this.documents.set(operation.path, {
          ...current,
          data: {
            ...current.data,
            ...clone(operation.patch || {}),
          },
        });
        continue;
      }

      if (operation.type === "delete") {
        this.documents.delete(operation.path);
        continue;
      }

      throw new Error(`Unsupported operation type: ${operation.type}`);
    }
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseCollectionPathFromDocumentPath(documentPath = "") {
  const segments = String(documentPath || "").split("/").filter(Boolean);
  if (segments.length < 2 || segments.length % 2 !== 0) return "";
  return segments.slice(0, -1).join("/");
}

function parseCollectionIdFromDocumentPath(documentPath = "") {
  const collectionPath = parseCollectionPathFromDocumentPath(documentPath);
  if (!collectionPath) return "";
  const segments = collectionPath.split("/");
  return segments[segments.length - 1] || "";
}

function parseDocumentId(documentPath = "") {
  const segments = String(documentPath || "").split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : "";
}

function doc(path, data) {
  return { path, data };
}

function datasetWithResetReferences() {
  const ownerUid = "owner-123";

  return [
    doc("categories/cat-food", { ownerUid, name: "Alimentation", type: "depense", createdAt: 2, updatedAt: 2 }),
    doc("categories/reset-owner-123-food", { ownerUid, name: "Alimentation", type: "depense", createdAt: 1, updatedAt: 1 }),
    doc("subcategories/sub-groceries", { ownerUid, name: "Courses", type: "depense", categoryId: "cat-food", createdAt: 2, updatedAt: 2 }),
    doc("subcategories/reset-owner-123-groceries", { ownerUid, name: "Courses", type: "depense", categoryId: "reset-owner-123-food", createdAt: 1, updatedAt: 1 }),

    doc("transactions/tx-reset", { ownerUid, categoryId: "reset-owner-123-food", subcategoryId: "reset-owner-123-groceries" }),
    doc("transactions/tx-canonical", { ownerUid, categoryId: "cat-food", subcategoryId: "sub-groceries" }),
    doc("budgets/bg-reset", { ownerUid, categoryId: "reset-owner-123-food", subcategoryId: "reset-owner-123-groceries" }),
    doc("fixedExpenses/fx-reset", { ownerUid, categoryId: "reset-owner-123-food" }),
    doc("recurringIncome/ri-reset", { ownerUid, categoryId: "reset-owner-123-food" }),
  ];
}

test("dry-run scans all docs and does not mutate state", async () => {
  const backend = new InMemoryBackend(datasetWithResetReferences());
  const before = await backend.scanAllDocuments();

  const report = await runMigrationWithBackend({
    backend,
    mode: "dry-run",
    batchSize: 2,
    projectId: "budget-alexandre",
  });

  const after = await backend.scanAllDocuments();

  assert.deepEqual(after, before);
  assert.equal(report.apply.appliedUpdates, 0);
  assert.equal(report.planning.plannedUpdates > 0, true);
  assert.equal(report.planning.projectedTotalRemainingResetReferencesAfterRemap, 0);
  assert.equal(report.apply.canDeleteResetDocuments, true);
  assert.equal(report.apply.projectedDeletedResetCategories, 1);
  assert.equal(report.apply.projectedDeletedResetSubcategories, 1);
  assert.equal(report.after.remainingResetCategoryReferenceCount, 0);
});

test("apply remaps only reset references and preserves canonical references", async () => {
  const backend = new InMemoryBackend(datasetWithResetReferences());

  const report = await runMigrationWithBackend({
    backend,
    mode: "apply",
    batchSize: 2,
    projectId: "budget-alexandre",
  });

  const docs = await backend.scanAllDocuments();
  const byPath = new Map(docs.map((document) => [document.path, document]));

  assert.equal(byPath.get("transactions/tx-reset").data.categoryId, "cat-food");
  assert.equal(byPath.get("transactions/tx-reset").data.subcategoryId, "sub-groceries");
  assert.equal(byPath.get("transactions/tx-canonical").data.categoryId, "cat-food");
  assert.equal(byPath.get("transactions/tx-canonical").data.subcategoryId, "sub-groceries");

  assert.equal(byPath.has("categories/cat-food"), true);
  assert.equal(byPath.has("categories/reset-owner-123-food"), false);
  assert.equal(byPath.has("subcategories/sub-groceries"), true);
  assert.equal(byPath.has("subcategories/reset-owner-123-groceries"), false);

  assert.equal(report.after.remainingResetCategoryReferenceCount, 0);
  assert.equal(report.after.remainingResetSubcategoryReferenceCount, 0);
});

test("interruption after partial commits can be resumed safely and is idempotent", async () => {
  const base = datasetWithResetReferences();

  const interruptedBackend = new InMemoryBackend(base, { failOnCommitNumber: 2 });
  await assert.rejects(
    runMigrationWithBackend({
      backend: interruptedBackend,
      mode: "apply",
      batchSize: 1,
      projectId: "budget-alexandre",
    }),
    /Simulated interruption/
  );

  const resumedBackend = new InMemoryBackend(
    (await interruptedBackend.scanAllDocuments()).map((document) => ({ path: document.path, data: document.data }))
  );

  const resumedReport = await runMigrationWithBackend({
    backend: resumedBackend,
    mode: "apply",
    batchSize: 1,
    projectId: "budget-alexandre",
  });

  const snapshotAfterResume = await resumedBackend.scanAllDocuments();

  const secondRunReport = await runMigrationWithBackend({
    backend: resumedBackend,
    mode: "apply",
    batchSize: 1,
    projectId: "budget-alexandre",
  });

  const snapshotAfterSecondRun = await resumedBackend.scanAllDocuments();

  assert.equal(resumedReport.after.remainingResetCategoryReferenceCount, 0);
  assert.equal(secondRunReport.apply.appliedUpdates, 0);
  assert.equal(secondRunReport.apply.deletedResetCategories, 0);
  assert.equal(secondRunReport.apply.deletedResetSubcategories, 0);
  assert.deepEqual(snapshotAfterSecondRun, snapshotAfterResume);
});

test("reset docs are not deleted when a global reference still exists", async () => {
  const ownerUid = "owner-123";
  const backend = new InMemoryBackend([
    // Two reset-only duplicates force a reset keeper that cannot be remapped away.
    doc("categories/reset-owner-123-food-a", { ownerUid, name: "Alimentation", type: "depense", createdAt: 2, updatedAt: 2 }),
    doc("categories/reset-owner-123-food-b", { ownerUid, name: "Alimentation", type: "depense", createdAt: 1, updatedAt: 1 }),
    doc("transactions/tx-a", { ownerUid, categoryId: "reset-owner-123-food-a" }),
    doc("archivedSnapshots/snap-1", { ownerUid, categoryId: "reset-owner-123-food-b" }),
  ]);

  const report = await runMigrationWithBackend({
    backend,
    mode: "apply",
    batchSize: 10,
    projectId: "budget-alexandre",
  });

  const docs = await backend.scanAllDocuments();
  const byPath = new Map(docs.map((document) => [document.path, document]));

  assert.equal(byPath.has("categories/reset-owner-123-food-b"), true);
  assert.equal(report.apply.canDeleteResetDocuments, false);
  assert.equal(report.after.remainingResetCategoryReferenceCount, 2);
  assert.deepEqual(
    report.after.remainingResetReferences.map((reference) => reference.path).sort((left, right) => left.localeCompare(right)),
    ["archivedSnapshots/snap-1", "transactions/tx-a"]
  );
});

test("applied counters increase only after successful commits", async () => {
  const backend = new InMemoryBackend(datasetWithResetReferences(), { failOnCommitNumber: 1 });

  await assert.rejects(
    runMigrationWithBackend({
      backend,
      mode: "apply",
      batchSize: 1,
      projectId: "budget-alexandre",
    }),
    /Simulated interruption/
  );

  // First commit failed before any mutation, so data must still contain reset references.
  const docs = await backend.scanAllDocuments();
  const hasResetReference = docs.some((document) => String(document.data?.categoryId || "").startsWith("reset-"));
  assert.equal(hasResetReference, true);
});
