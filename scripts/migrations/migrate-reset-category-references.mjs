import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeName } from "../reference-seed-lib.mjs";
import { assertAutomatedWriteAllowed } from "../safety/automatedWriteGuard.mjs";

const DEFAULT_BATCH_SIZE = 400;
const CATEGORY_COLLECTION_ID = "categories";
const SUBCATEGORY_COLLECTION_ID = "subcategories";

function parseArgs(argv) {
  const options = {
    mode: "dry-run",
    projectId: undefined,
    databaseId: "(default)",
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of argv) {
    if (arg === "--apply") {
      options.mode = "apply";
      continue;
    }
    if (arg === "--dry-run") {
      options.mode = "dry-run";
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      options.projectId = arg.slice("--project-id=".length).trim();
      continue;
    }
    if (arg.startsWith("--database-id=")) {
      options.databaseId = arg.slice("--database-id=".length).trim();
      continue;
    }
    if (arg.startsWith("--batch-size=")) {
      options.batchSize = Number(arg.slice("--batch-size=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.projectId) {
    throw new Error("--project-id is required.");
  }

  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500.");
  }

  return options;
}

function loadDotEnvValue(filePath, key) {
  try {
    const content = readFileSync(filePath, "utf8");
    const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

function resolveProjectId(explicitProjectId = "") {
  const envFilePath = resolve(process.cwd(), ".env");

  return (
    String(explicitProjectId || "").trim() ||
    String(process.env.FIREBASE_PROJECT_ID || "").trim() ||
    String(process.env.GCLOUD_PROJECT || "").trim() ||
    String(process.env.VITE_FIREBASE_PROJECT_ID || "").trim() ||
    loadDotEnvValue(envFilePath, "FIREBASE_PROJECT_ID") ||
    loadDotEnvValue(envFilePath, "VITE_FIREBASE_PROJECT_ID") ||
    ""
  );
}

function isResetId(id = "") {
  return String(id || "").startsWith("reset-");
}

function normalizeType(type = "depense") {
  const normalized = normalizeName(type || "depense");
  return normalized || "depense";
}

function toMillis(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  if (typeof value === "number") return value;
  return Number.POSITIVE_INFINITY;
}

function parseCollectionPathFromDocumentPath(documentPath = "") {
  const segments = String(documentPath || "").split("/").filter(Boolean);
  if (segments.length < 2 || segments.length % 2 !== 0) {
    return "";
  }

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

function hasReferenceFields(data = {}) {
  return Object.prototype.hasOwnProperty.call(data, "categoryId") || Object.prototype.hasOwnProperty.call(data, "subcategoryId");
}

function compareKeepers(left, right) {
  const leftReset = isResetId(left?.id);
  const rightReset = isResetId(right?.id);
  if (leftReset !== rightReset) {
    return leftReset ? 1 : -1;
  }

  const leftCreatedAt = toMillis(left?.data?.createdAt);
  const rightCreatedAt = toMillis(right?.data?.createdAt);
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

  const leftUpdatedAt = toMillis(left?.data?.updatedAt);
  const rightUpdatedAt = toMillis(right?.data?.updatedAt);
  if (leftUpdatedAt !== rightUpdatedAt) return leftUpdatedAt - rightUpdatedAt;

  return String(left?.id || "").localeCompare(String(right?.id || ""));
}

function buildCategoryGroupKey(categoryDoc) {
  const ownerUid = String(categoryDoc?.data?.ownerUid || "").trim();
  const nameKey = normalizeName(categoryDoc?.data?.name || "");
  const typeKey = normalizeType(categoryDoc?.data?.type || "depense");

  if (!ownerUid || !nameKey) return "";
  return `${ownerUid}::${nameKey}::${typeKey}`;
}

function buildSubcategoryGroupKey(subcategoryDoc, categoryById = new Map(), categoryRemap = new Map()) {
  const ownerUid = String(subcategoryDoc?.data?.ownerUid || "").trim();
  const subcategoryNameKey = normalizeName(subcategoryDoc?.data?.name || "");
  const rawCategoryId = String(subcategoryDoc?.data?.categoryId || "").trim();
  const canonicalCategoryId = categoryRemap.get(rawCategoryId) || rawCategoryId;
  const categoryDoc = categoryById.get(canonicalCategoryId) || categoryById.get(rawCategoryId) || null;
  const categoryNameKey = normalizeName(categoryDoc?.data?.name || "");
  const typeKey = normalizeType(subcategoryDoc?.data?.type || categoryDoc?.data?.type || "depense");

  if (!ownerUid || !subcategoryNameKey || !categoryNameKey) return "";
  return `${ownerUid}::${categoryNameKey}::${typeKey}::${subcategoryNameKey}`;
}

export function buildCategoryRemapPlan(categoryDocs = []) {
  const groups = new Map();
  const categoryById = new Map();

  for (const doc of categoryDocs) {
    if (!doc?.id) continue;
    categoryById.set(doc.id, doc);

    const key = buildCategoryGroupKey(doc);
    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const remapByCategoryId = new Map();
  const resetCategoryDeletionCandidates = new Set();
  const duplicateGroups = [];

  for (const [groupKey, docs] of groups.entries()) {
    if (docs.length < 2) continue;

    const sorted = [...docs].sort(compareKeepers);
    const keeper = sorted[0];
    const duplicates = sorted.slice(1);

    duplicateGroups.push({ key: groupKey, keeperId: keeper.id, duplicateIds: duplicates.map((doc) => doc.id) });

    for (const duplicate of duplicates) {
      if (!isResetId(duplicate.id)) {
        continue;
      }
      remapByCategoryId.set(duplicate.id, keeper.id);
      resetCategoryDeletionCandidates.add(duplicate.id);
    }

    if (isResetId(keeper.id)) {
      resetCategoryDeletionCandidates.add(keeper.id);
    }
  }

  return {
    categoryById,
    remapByCategoryId,
    resetCategoryDeletionCandidates,
    duplicateGroups,
  };
}

export function buildSubcategoryRemapPlan(subcategoryDocs = [], categoryById = new Map(), categoryRemap = new Map()) {
  const groups = new Map();

  for (const doc of subcategoryDocs) {
    if (!doc?.id) continue;

    const key = buildSubcategoryGroupKey(doc, categoryById, categoryRemap);
    if (!key) continue;

    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(doc);
  }

  const remapBySubcategoryId = new Map();
  const resetSubcategoryDeletionCandidates = new Set();
  const duplicateGroups = [];

  for (const [groupKey, docs] of groups.entries()) {
    if (docs.length < 2) continue;

    const sorted = [...docs].sort(compareKeepers);
    const keeper = sorted[0];
    const duplicates = sorted.slice(1);

    duplicateGroups.push({ key: groupKey, keeperId: keeper.id, duplicateIds: duplicates.map((doc) => doc.id) });

    for (const duplicate of duplicates) {
      if (!isResetId(duplicate.id)) {
        continue;
      }
      remapBySubcategoryId.set(duplicate.id, keeper.id);
      resetSubcategoryDeletionCandidates.add(duplicate.id);
    }

    if (isResetId(keeper.id)) {
      resetSubcategoryDeletionCandidates.add(keeper.id);
    }
  }

  return {
    remapBySubcategoryId,
    resetSubcategoryDeletionCandidates,
    duplicateGroups,
  };
}

export function buildDocumentReferencePatch(documentData = {}, categoryRemap = new Map(), subcategoryRemap = new Map()) {
  const patch = {};
  const categoryId = String(documentData?.categoryId || "").trim();
  const subcategoryId = String(documentData?.subcategoryId || "").trim();

  if (categoryRemap.has(categoryId)) {
    patch.categoryId = categoryRemap.get(categoryId);
  }

  if (subcategoryRemap.has(subcategoryId)) {
    patch.subcategoryId = subcategoryRemap.get(subcategoryId);
  }

  return patch;
}

function createFirestoreBackend(db) {
  async function scanCollectionRecursively(collectionRef, accumulator) {
    const snapshot = await collectionRef.get();

    for (const document of snapshot.docs) {
      const path = document.ref.path;
      const data = document.data() || {};

      accumulator.push({
        path,
        id: parseDocumentId(path),
        collectionPath: parseCollectionPathFromDocumentPath(path),
        collectionId: parseCollectionIdFromDocumentPath(path),
        data,
      });

      const subcollections = await document.ref.listCollections();
      for (const subcollection of subcollections) {
        await scanCollectionRecursively(subcollection, accumulator);
      }
    }
  }

  return {
    async scanAllDocuments() {
      const documents = [];
      const rootCollections = await db.listCollections();

      for (const rootCollection of rootCollections) {
        await scanCollectionRecursively(rootCollection, documents);
      }

      return documents;
    },

    async commitBatch(operations = []) {
      const batch = db.batch();

      for (const operation of operations) {
        const ref = db.doc(operation.path);
        if (operation.type === "update") {
          batch.update(ref, operation.patch);
        } else if (operation.type === "delete") {
          batch.delete(ref);
        } else {
          throw new Error(`Unsupported operation type: ${operation.type}`);
        }
      }

      await batch.commit();
    },
  };
}

function buildReferenceSnapshot(documents = [], resetCategoryIds = new Set(), resetSubcategoryIds = new Set()) {
  const references = [];

  for (const document of documents) {
    const categoryId = String(document?.data?.categoryId || "").trim();
    const subcategoryId = String(document?.data?.subcategoryId || "").trim();

    if (resetCategoryIds.has(categoryId)) {
      references.push({
        path: document.path,
        collectionPath: document.collectionPath,
        field: "categoryId",
        value: categoryId,
      });
    }

    if (resetSubcategoryIds.has(subcategoryId)) {
      references.push({
        path: document.path,
        collectionPath: document.collectionPath,
        field: "subcategoryId",
        value: subcategoryId,
      });
    }
  }

  return references;
}

function buildPlannedUpdates({ documents = [], categoryRemap = new Map(), subcategoryRemap = new Map() }) {
  const operations = [];
  const byCollectionPath = new Map();

  for (const document of documents) {
    if (!hasReferenceFields(document.data)) {
      continue;
    }

    const patch = buildDocumentReferencePatch(document.data, categoryRemap, subcategoryRemap);
    if (Object.keys(patch).length === 0) {
      continue;
    }

    operations.push({ type: "update", path: document.path, patch, collectionPath: document.collectionPath });
    byCollectionPath.set(document.collectionPath, (byCollectionPath.get(document.collectionPath) || 0) + 1);
  }

  return {
    operations,
    byCollectionPath,
    plannedCount: operations.length,
  };
}

function chunk(array = [], size = DEFAULT_BATCH_SIZE) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

async function applyBatchedOperations(backend, operations = [], batchSize = DEFAULT_BATCH_SIZE) {
  const byCollectionPath = new Map();
  let appliedCount = 0;

  for (const group of chunk(operations, batchSize)) {
    await backend.commitBatch(group);

    appliedCount += group.length;
    for (const operation of group) {
      byCollectionPath.set(operation.collectionPath, (byCollectionPath.get(operation.collectionPath) || 0) + 1);
    }
  }

  return { appliedCount, byCollectionPath };
}

function toSortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

function createCollectionSummary(documents = []) {
  const counts = new Map();
  const referenceBearingCollectionPaths = new Set();

  for (const document of documents) {
    counts.set(document.collectionPath, (counts.get(document.collectionPath) || 0) + 1);
    if (hasReferenceFields(document.data)) {
      referenceBearingCollectionPaths.add(document.collectionPath);
    }
  }

  return {
    totalDocuments: documents.length,
    documentsByCollectionPath: toSortedObject(counts),
    referenceBearingCollectionPaths: [...referenceBearingCollectionPaths].sort((left, right) => left.localeCompare(right)),
  };
}

function cloneDocument(document = {}) {
  return {
    ...document,
    data: { ...(document.data || {}) },
  };
}

function applyOperationsInMemory(documents = [], operations = []) {
  const byPath = new Map(documents.map((document) => [document.path, cloneDocument(document)]));

  for (const operation of operations) {
    if (operation.type === "update") {
      const current = byPath.get(operation.path);
      if (!current) continue;
      byPath.set(operation.path, {
        ...current,
        data: {
          ...current.data,
          ...(operation.patch || {}),
        },
      });
      continue;
    }

    if (operation.type === "delete") {
      byPath.delete(operation.path);
    }
  }

  return [...byPath.values()];
}

function buildResetDeleteOperations({ categoryDocs = [], subcategoryDocs = [], resetCategoryDeletionCandidates = new Set(), resetSubcategoryDeletionCandidates = new Set() }) {
  const categoryDeletes = [];
  const subcategoryDeletes = [];

  for (const doc of categoryDocs) {
    if (resetCategoryDeletionCandidates.has(doc.id)) {
      categoryDeletes.push({ type: "delete", path: doc.path, collectionPath: doc.collectionPath });
    }
  }

  for (const doc of subcategoryDocs) {
    if (resetSubcategoryDeletionCandidates.has(doc.id)) {
      subcategoryDeletes.push({ type: "delete", path: doc.path, collectionPath: doc.collectionPath });
    }
  }

  return {
    categoryDeletes,
    subcategoryDeletes,
  };
}

export async function runMigrationWithBackend({ backend, mode = "dry-run", batchSize = DEFAULT_BATCH_SIZE, projectId = "", databaseId = "(default)" } = {}) {
  if (!backend || typeof backend.scanAllDocuments !== "function" || typeof backend.commitBatch !== "function") {
    throw new Error("A migration backend with scanAllDocuments and commitBatch is required.");
  }

  if (!["dry-run", "apply"].includes(mode)) {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const beforeDocuments = await backend.scanAllDocuments();
  const beforeCollectionSummary = createCollectionSummary(beforeDocuments);

  const categoryDocs = beforeDocuments.filter((document) => document.collectionId === CATEGORY_COLLECTION_ID);
  const subcategoryDocs = beforeDocuments.filter((document) => document.collectionId === SUBCATEGORY_COLLECTION_ID);

  const categoryPlan = buildCategoryRemapPlan(categoryDocs);
  const subcategoryPlan = buildSubcategoryRemapPlan(subcategoryDocs, categoryPlan.categoryById, categoryPlan.remapByCategoryId);

  const beforeReferences = buildReferenceSnapshot(
    beforeDocuments,
    categoryPlan.resetCategoryDeletionCandidates,
    subcategoryPlan.resetSubcategoryDeletionCandidates
  );

  const plannedUpdateBundle = buildPlannedUpdates({
    documents: beforeDocuments,
    categoryRemap: categoryPlan.remapByCategoryId,
    subcategoryRemap: subcategoryPlan.remapBySubcategoryId,
  });

  const plannedUpdatesByCollectionPath = plannedUpdateBundle.byCollectionPath;
  let appliedUpdatesByCollectionPath = new Map();
  let appliedUpdates = 0;
  let afterUpdateDocuments = beforeDocuments;

  if (mode === "apply" && plannedUpdateBundle.operations.length > 0) {
    const updateResult = await applyBatchedOperations(backend, plannedUpdateBundle.operations, batchSize);
    appliedUpdates = updateResult.appliedCount;
    appliedUpdatesByCollectionPath = updateResult.byCollectionPath;
    afterUpdateDocuments = await backend.scanAllDocuments();
  } else if (mode === "apply") {
    afterUpdateDocuments = await backend.scanAllDocuments();
  } else {
    afterUpdateDocuments = applyOperationsInMemory(beforeDocuments, plannedUpdateBundle.operations);
  }

  const afterUpdateReferences = buildReferenceSnapshot(
    afterUpdateDocuments,
    categoryPlan.resetCategoryDeletionCandidates,
    subcategoryPlan.resetSubcategoryDeletionCandidates
  );

  const canDeleteResetDocuments = afterUpdateReferences.length === 0;
  const deleteBundle = buildResetDeleteOperations({
    categoryDocs: afterUpdateDocuments.filter((document) => document.collectionId === CATEGORY_COLLECTION_ID),
    subcategoryDocs: afterUpdateDocuments.filter((document) => document.collectionId === SUBCATEGORY_COLLECTION_ID),
    resetCategoryDeletionCandidates: categoryPlan.resetCategoryDeletionCandidates,
    resetSubcategoryDeletionCandidates: subcategoryPlan.resetSubcategoryDeletionCandidates,
  });

  let deletedResetCategories = 0;
  let deletedResetSubcategories = 0;
  let afterDocuments = afterUpdateDocuments;

  if (mode === "apply" && canDeleteResetDocuments) {
    if (deleteBundle.categoryDeletes.length > 0) {
      const categoryDeleteResult = await applyBatchedOperations(backend, deleteBundle.categoryDeletes, batchSize);
      deletedResetCategories = categoryDeleteResult.appliedCount;
    }

    if (deleteBundle.subcategoryDeletes.length > 0) {
      const subcategoryDeleteResult = await applyBatchedOperations(backend, deleteBundle.subcategoryDeletes, batchSize);
      deletedResetSubcategories = subcategoryDeleteResult.appliedCount;
    }

    afterDocuments = await backend.scanAllDocuments();
  } else if (mode === "apply") {
    afterDocuments = await backend.scanAllDocuments();
  } else if (canDeleteResetDocuments) {
    afterDocuments = applyOperationsInMemory(afterUpdateDocuments, [
      ...deleteBundle.categoryDeletes,
      ...deleteBundle.subcategoryDeletes,
    ]);
  }
  const afterCollectionSummary = createCollectionSummary(afterDocuments);

  const afterCategoryDocs = afterDocuments.filter((document) => document.collectionId === CATEGORY_COLLECTION_ID);
  const afterSubcategoryDocs = afterDocuments.filter((document) => document.collectionId === SUBCATEGORY_COLLECTION_ID);

  const afterCategoryNameCounts = new Map();
  for (const doc of afterCategoryDocs) {
    const ownerUid = String(doc.data?.ownerUid || "").trim();
    const nameKey = normalizeName(doc.data?.name || "");
    if (!ownerUid || !nameKey) continue;
    const key = `${ownerUid}::${nameKey}`;
    afterCategoryNameCounts.set(key, (afterCategoryNameCounts.get(key) || 0) + 1);
  }

  const afterDuplicateCategoryNames = [...afterCategoryNameCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => left.key.localeCompare(right.key));

  const finalReferences = buildReferenceSnapshot(
    afterDocuments,
    categoryPlan.resetCategoryDeletionCandidates,
    subcategoryPlan.resetSubcategoryDeletionCandidates
  );

  const report = {
    projectId,
    databaseId,
    mode,
    before: {
      ...beforeCollectionSummary,
      resetCategoryReferenceCount: beforeReferences.filter((reference) => reference.field === "categoryId").length,
      resetSubcategoryReferenceCount: beforeReferences.filter((reference) => reference.field === "subcategoryId").length,
      totalResetReferenceCount: beforeReferences.length,
    },
    planning: {
      duplicateCategoryGroups: categoryPlan.duplicateGroups.length,
      duplicateSubcategoryGroups: subcategoryPlan.duplicateGroups.length,
      categoryRemapCount: categoryPlan.remapByCategoryId.size,
      subcategoryRemapCount: subcategoryPlan.remapBySubcategoryId.size,
      resetCategoryDeletionCandidates: categoryPlan.resetCategoryDeletionCandidates.size,
      resetSubcategoryDeletionCandidates: subcategoryPlan.resetSubcategoryDeletionCandidates.size,
      plannedUpdates: plannedUpdateBundle.plannedCount,
      plannedUpdatesByCollectionPath: toSortedObject(plannedUpdatesByCollectionPath),
      projectedRemainingResetCategoryReferencesAfterRemap: afterUpdateReferences.filter((reference) => reference.field === "categoryId").length,
      projectedRemainingResetSubcategoryReferencesAfterRemap: afterUpdateReferences.filter((reference) => reference.field === "subcategoryId").length,
      projectedTotalRemainingResetReferencesAfterRemap: afterUpdateReferences.length,
      projectedCanDeleteResetDocuments: canDeleteResetDocuments,
      plannedResetCategoryDeletes: deleteBundle.categoryDeletes.length,
      plannedResetSubcategoryDeletes: deleteBundle.subcategoryDeletes.length,
    },
    apply: {
      attempted: mode === "apply",
      appliedUpdates,
      appliedUpdatesByCollectionPath: toSortedObject(appliedUpdatesByCollectionPath),
      canDeleteResetDocuments,
      deletedResetCategories,
      deletedResetSubcategories,
      projectedDeletedResetCategories: deleteBundle.categoryDeletes.length,
      projectedDeletedResetSubcategories: deleteBundle.subcategoryDeletes.length,
    },
    after: {
      ...afterCollectionSummary,
      remainingResetCategoryReferenceCount: finalReferences.filter((reference) => reference.field === "categoryId").length,
      remainingResetSubcategoryReferenceCount: finalReferences.filter((reference) => reference.field === "subcategoryId").length,
      remainingResetReferences: finalReferences,
      categoriesCount: afterCategoryDocs.length,
      subcategoriesCount: afterSubcategoryDocs.length,
      duplicateCategoryNamesByOwnerCount: afterDuplicateCategoryNames.length,
      duplicateCategoryNamesByOwner: afterDuplicateCategoryNames,
    },
  };

  return report;
}

async function loadFirebaseAdmin() {
  const appModule = await import("firebase-admin/app");
  const firestoreModule = await import("firebase-admin/firestore");
  return { ...appModule, ...firestoreModule };
}

async function buildFirestoreBackend({ projectId, databaseId }) {
  const { initializeApp, getApps, cert, applicationDefault, getFirestore } = await loadFirebaseAdmin();
  const serviceAccountPath = resolve(process.cwd(), "scripts/maintenance/service-account.json");
  const options = { projectId };

  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    options.credential = cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    options.credential = applicationDefault();
  } else {
    try {
      options.credential = cert(JSON.parse(readFileSync(serviceAccountPath, "utf8")));
    } catch {
      // Fall back to implicit credentials when available.
    }
  }

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(options);
  const db = getFirestore(app, databaseId);
  return createFirestoreBackend(db);
}

export async function runMigration(options = {}) {
  const mode = options.mode || (options.apply ? "apply" : "dry-run");
  const projectId = resolveProjectId(options.projectId);
  const databaseId = options.databaseId || "(default)";
  const batchSize = Number(options.batchSize || DEFAULT_BATCH_SIZE);

  if (!projectId) {
    throw new Error("projectId is required.");
  }

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("batchSize must be an integer between 1 and 500.");
  }

  if (mode === "apply") {
    assertAutomatedWriteAllowed({ projectId, operationName: "migrations:migrate-reset-category-references" });
  }

  const backend = await buildFirestoreBackend({ projectId, databaseId });
  return runMigrationWithBackend({ backend, mode, batchSize, projectId, databaseId });
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  const report = await runMigration({
    mode: parsed.mode,
    projectId: parsed.projectId,
    databaseId: parsed.databaseId,
    batchSize: parsed.batchSize,
  });

  console.log(JSON.stringify(report, null, 2));
}

const SCRIPT_PATH = resolve(fileURLToPath(import.meta.url));
if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error(error?.stack || String(error));
    process.exitCode = 1;
  });
}
