import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, GeoPoint, getFirestore } from "firebase-admin/firestore";

export const ALLOW_PRODUCTION_APPLY = false;
export const DEFAULT_DATABASE_ID = "(default)";
export const DEFAULT_BATCH_SIZE = 450;
export const DEFAULT_REPORT_DIR = "artifacts/security";
export const PROTECTED_COLLECTIONS = [
  "accounts",
  "transactions",
  "categories",
  "subcategories",
  "thirdParties",
  "activities",
  "projects",
  "budgets",
  "goals",
  "objectives",
  "fixedExpenses",
  "recurringIncome",
  "bankImports",
  "receiptDrafts",
  "transactionDrafts",
  "opportunities",
  "transfers",
];

export const OUT_OF_SCOPE_COLLECTIONS_TO_REVIEW = ["fraisFixes", "parametres", "tickets"];

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = {
    dryRun: true,
    apply: false,
    applyProduction: false,
    databaseId: DEFAULT_DATABASE_ID,
    reportDir: DEFAULT_REPORT_DIR,
    batchSize: DEFAULT_BATCH_SIZE,
    fixtureReviewMode: false,
    seedFixture: false,
    fixtureReviewMode: false,
    fixturePath: null,
    reportName: "owner-uid-migration-dry-run.json",
    markdownName: "OWNER_UID_MIGRATION_DRY_RUN.md",
    resumeFrom: null,
    limit: null,
    expectedDocumentCount: null,
    simulateInterruptAfterBatches: null,
    reportNameExplicit: false,
    markdownNameExplicit: false,
    ownerUidExplicit: false,
    projectIdExplicit: false,
    databaseIdExplicit: false,
    backupPathExplicit: false,
    expectedDocumentCountExplicit: false,
  };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
      options.apply = false;
    } else if (arg === "--apply") {
      options.apply = true;
      options.dryRun = false;
    } else if (arg === "--apply-production") {
      options.applyProduction = true;
      options.dryRun = false;
    } else if (arg === "--seed-fixture") {
      options.seedFixture = true;
      options.fixtureReviewMode = true;
    } else if (arg === "--fixture-review-mode") {
      options.fixtureReviewMode = true;
    } else if (arg.startsWith("--owner-uid=")) {
      options.ownerUid = arg.slice("--owner-uid=".length);
      options.ownerUidExplicit = true;
    } else if (arg.startsWith("--project-id=")) {
      options.projectId = arg.slice("--project-id=".length);
      options.projectIdExplicit = true;
    } else if (arg.startsWith("--confirm-project-id=")) {
      options.confirmProjectId = arg.slice("--confirm-project-id=".length);
    } else if (arg.startsWith("--database-id=")) {
      options.databaseId = arg.slice("--database-id=".length);
      options.databaseIdExplicit = true;
    } else if (arg.startsWith("--backup-path=")) {
      options.backupPath = arg.slice("--backup-path=".length);
      options.backupPathExplicit = true;
    } else if (arg.startsWith("--fixture-path=")) {
      options.fixturePath = arg.slice("--fixture-path=".length);
    } else if (arg.startsWith("--report-dir=")) {
      options.reportDir = arg.slice("--report-dir=".length);
    } else if (arg.startsWith("--report-name=")) {
      options.reportName = arg.slice("--report-name=".length);
      options.reportNameExplicit = true;
    } else if (arg.startsWith("--markdown-name=")) {
      options.markdownName = arg.slice("--markdown-name=".length);
      options.markdownNameExplicit = true;
    } else if (arg.startsWith("--batch-size=")) {
      options.batchSize = Number(arg.slice("--batch-size=".length));
    } else if (arg.startsWith("--expected-document-count=")) {
      options.expectedDocumentCount = Number(arg.slice("--expected-document-count=".length));
      options.expectedDocumentCountExplicit = true;
    } else if (arg.startsWith("--resume-from=")) {
      options.resumeFrom = arg.slice("--resume-from=".length);
    } else if (arg.startsWith("--limit=")) {
      options.limit = Number(arg.slice("--limit=".length));
    } else if (arg.startsWith("--simulate-interrupt-after-batches=")) {
      options.simulateInterruptAfterBatches = Number(arg.slice("--simulate-interrupt-after-batches=".length));
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  options.ownerUid ||= process.env.MIGRATION_OWNER_UID;
  options.projectId ||= process.env.MIGRATION_PROJECT_ID;
  options.backupPath ||= process.env.MIGRATION_BACKUP_PATH;
  return options;
}

function validateOwnerUid(ownerUid) {
  if (typeof ownerUid !== "string" || ownerUid.length === 0) {
    throw new Error("Missing --owner-uid or MIGRATION_OWNER_UID.");
  }
  if (ownerUid.trim() !== ownerUid || /\s/.test(ownerUid)) {
    throw new Error("ownerUid must not contain whitespace.");
  }
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(ownerUid)) {
    throw new Error("ownerUid format looks invalid.");
  }
}

function validateOptions(options) {
  validateOwnerUid(options.ownerUid);
  if (!options.projectId) {
    throw new Error("Missing explicit --project-id or MIGRATION_PROJECT_ID.");
  }
  if (options.confirmProjectId && options.confirmProjectId !== options.projectId) {
    throw new Error("--confirm-project-id does not match --project-id.");
  }
  if (!options.databaseId) {
    throw new Error("Missing explicit --database-id.");
  }
  if (!options.backupPath) {
    throw new Error("Missing --backup-path or MIGRATION_BACKUP_PATH.");
  }
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size must be an integer between 1 and 500.");
  }
  if (options.expectedDocumentCount !== null && (!Number.isInteger(options.expectedDocumentCount) || options.expectedDocumentCount < 0)) {
    throw new Error("--expected-document-count must be a positive integer.");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) {
    throw new Error("--limit must be a positive integer.");
  }
  if (options.apply) {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("Production apply is blocked in this sprint. FIRESTORE_EMULATOR_HOST is required for --apply.");
    }
    if (ALLOW_PRODUCTION_APPLY) {
      throw new Error("Invalid sprint safety configuration.");
    }
  }
  if (options.applyProduction) {
    if (options.apply) {
      throw new Error("--apply-production cannot be combined with --apply.");
    }
    if (process.env.FIRESTORE_EMULATOR_HOST) {
      throw new Error("--apply-production refuses FIRESTORE_EMULATOR_HOST.");
    }
    if (!options.confirmProjectId) {
      throw new Error("--apply-production requires --confirm-project-id.");
    }
    if (!options.projectIdExplicit || !options.databaseIdExplicit || !options.backupPathExplicit || !options.expectedDocumentCountExplicit || !options.ownerUidExplicit) {
      throw new Error("--apply-production requires explicit --project-id, --database-id, --backup-path, --expected-document-count and --owner-uid.");
    }
    if (options.confirmProjectId !== options.projectId) {
      throw new Error("--confirm-project-id does not match --project-id.");
    }
    if (options.expectedDocumentCount === null) {
      throw new Error("--apply-production requires --expected-document-count.");
    }
    if (!options.reportNameExplicit || !options.markdownNameExplicit) {
      throw new Error("--apply-production requires explicit --report-name and --markdown-name.");
    }
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalize(entry));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonicalize(entry)]));
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value));
}

function approximateBytes(value) {
  return Buffer.byteLength(stableJson(value), "utf8");
}

function scanValue(value, path = []) {
  const result = {
    documentReferences: [],
    timestamps: [],
    sensitiveFields: [],
    atypicalFields: [],
  };
  const fieldPath = path.join(".");
  if (["token", "secret", "password", "apiKey"].some((needle) => fieldPath.toLowerCase().includes(needle.toLowerCase()))) {
    result.sensitiveFields.push(fieldPath);
  }
  if (value && typeof value === "object") {
    if (value.__firestoreType === "documentReference") {
      result.documentReferences.push({ fieldPath, path: value.path });
    }
    if (["timestamp", "date"].includes(value.__firestoreType)) {
      result.timestamps.push({ fieldPath, value: value.iso || null });
    }
    if (value.__firestoreType === "unknown") {
      result.atypicalFields.push({ fieldPath, type: value.constructorName || "unknown" });
    }
    for (const [key, nested] of Object.entries(value)) {
      if (key !== "__firestoreType") {
        const nestedScan = scanValue(nested, [...path, key]);
        result.documentReferences.push(...nestedScan.documentReferences);
        result.timestamps.push(...nestedScan.timestamps);
        result.sensitiveFields.push(...nestedScan.sensitiveFields);
        result.atypicalFields.push(...nestedScan.atypicalFields);
      }
    }
  }
  return result;
}

function classifyDocument({ collection, document, ownerUidTarget, inScope }) {
  const data = document.data || {};
  if (!inScope) {
    return "OUT_OF_SCOPE";
  }
  if (!Object.hasOwn(data, "ownerUid")) {
    return "MIGRATABLE_MISSING_OWNERUID";
  }
  if (typeof data.ownerUid !== "string") {
    return "INVALID_OWNERUID_TYPE";
  }
  if (data.ownerUid === ownerUidTarget) {
    return "ALREADY_COMPLIANT";
  }
  return "CONFLICTING_OWNERUID";
}

async function loadBackup(backupPath) {
  const absoluteBackupPath = resolve(process.cwd(), backupPath);
  const manifest = await readJson(resolve(absoluteBackupPath, "manifest.json"));
  if (manifest.result !== "success") {
    throw new Error(`Backup manifest is not successful: ${manifest.result}`);
  }
  const collections = new Map();
  for (const collectionName of manifest.collectionsExported || []) {
    const collectionPayload = await readJson(resolve(absoluteBackupPath, "collections", `${collectionName}.json`));
    collections.set(collectionName, collectionPayload);
  }
  return { backupPath: absoluteBackupPath, manifest, collections };
}

function flattenDocuments(collectionPayload) {
  const docs = [];
  for (const document of collectionPayload.documents || []) {
    docs.push(document);
    for (const nestedCollection of Object.values(document.subcollections || {})) {
      docs.push(...flattenDocuments(nestedCollection));
    }
  }
  return docs;
}

function buildCollectionBreakdown({ manifest, collections, ownerUidTarget }) {
  const exportedNames = new Set(manifest.collectionsExported || []);
  const allNames = new Set([...PROTECTED_COLLECTIONS, ...exportedNames]);
  const breakdown = [];

  for (const collection of [...allNames].sort()) {
    const protectedByRules = PROTECTED_COLLECTIONS.includes(collection);
    const payload = collections.get(collection);
    const documents = payload ? flattenDocuments(payload) : [];
    let category = "E_UNKNOWN_OR_HISTORICAL";
    if (protectedByRules && documents.length > 0) category = "A_PROTECTED_WITH_DOCUMENTS";
    if (protectedByRules && documents.length === 0) category = "B_PROTECTED_EMPTY";
    if (!protectedByRules && OUT_OF_SCOPE_COLLECTIONS_TO_REVIEW.includes(collection)) category = "C_NOT_COVERED_BY_RULES";
    if (!protectedByRules && !OUT_OF_SCOPE_COLLECTIONS_TO_REVIEW.includes(collection)) category = "E_UNKNOWN_OR_HISTORICAL";

    const counts = {
      MIGRATABLE_MISSING_OWNERUID: 0,
      ALREADY_COMPLIANT: 0,
      CONFLICTING_OWNERUID: 0,
      INVALID_OWNERUID_TYPE: 0,
      OUT_OF_SCOPE: 0,
      MANUAL_REVIEW_REQUIRED: 0,
    };
    for (const document of documents) {
      counts[classifyDocument({ collection, document, ownerUidTarget, inScope: protectedByRules })] += 1;
    }

    breakdown.push({
      collection,
      protectedByRules,
      category,
      backupFileFound: Boolean(payload),
      rootDocumentCount: payload?.documentCount || 0,
      totalDocuments: documents.length,
      subcollectionsDetected: manifest.collectionsWithSubcollectionsDetected?.[collection] || [],
      ...counts,
    });
  }

  return breakdown;
}

function buildDocumentAudit({ collections, ownerUidTarget }) {
  const audited = [];
  const seenDataHashes = new Map();

  for (const [collection, payload] of collections.entries()) {
    const inScope = PROTECTED_COLLECTIONS.includes(collection);
    for (const document of flattenDocuments(payload)) {
      const data = document.data || {};
      const scan = scanValue(data);
      const dataHash = stableJson(data);
      const duplicatePaths = seenDataHashes.get(dataHash) || [];
      seenDataHashes.set(dataHash, [...duplicatePaths, document.path]);
      const classification = classifyDocument({ collection, document, ownerUidTarget, inScope });
      audited.push({
        path: document.path,
        collection,
        documentId: document.id,
        classification,
        ownerUidPresent: Object.hasOwn(data, "ownerUid"),
        ownerUidValue: Object.hasOwn(data, "ownerUid") ? data.ownerUid : null,
        ownerUidType: Object.hasOwn(data, "ownerUid") ? (Array.isArray(data.ownerUid) ? "array" : typeof data.ownerUid) : "missing",
        approximateSizeBytes: approximateBytes(data),
        sensitiveFields: scan.sensitiveFields,
        documentReferences: scan.documentReferences,
        timestamps: scan.timestamps,
        atypicalFields: scan.atypicalFields,
        hasSubcollections: Object.keys(document.subcollections || {}).length > 0,
        duplicateCandidatePaths: duplicatePaths,
        orphanSignals: [],
      });
    }
  }

  return audited;
}

function buildPlannedOperations({ documentAudit, ownerUidTarget, resumeFrom = null, limit = null }) {
  const all = documentAudit
    .filter((document) => document.classification === "MIGRATABLE_MISSING_OWNERUID")
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((document, index) => ({
      index,
      path: document.path,
      collection: document.collection,
      documentId: document.documentId,
      patch: { ownerUid: ownerUidTarget },
      operation: "batch.update",
    }));

  let startIndex = 0;
  if (resumeFrom) {
    const cursorIndex = all.findIndex((operation) => operation.path === resumeFrom);
    if (cursorIndex === -1) {
      throw new Error(`--resume-from path not found in planned operations: ${resumeFrom}`);
    }
    startIndex = cursorIndex;
  }
  const resumed = all.slice(startIndex);
  return limit ? resumed.slice(0, limit) : resumed;
}

function estimateBatches(total, batchSize) {
  return {
    batchSize,
    estimatedBatchCount: total === 0 ? 0 : Math.ceil(total / batchSize),
    lastBatchSize: total === 0 ? 0 : ((total - 1) % batchSize) + 1,
    exactWriteCount: total,
    estimatedDuration: total === 0 ? "0s" : "seconds to a few minutes on Emulator; production duration must be measured during the real migration window",
    quotaRisk: total <= 500 ? "LOW_SINGLE_OR_SMALL_BATCH" : "REVIEW_BATCH_WINDOWS",
    resumeStrategy: "--resume-from=<documentPath> resumes at the next planned path boundary selected by the operator.",
  };
}

export async function buildMigrationReport(rawOptions) {
  const options = {
    dryRun: true,
    apply: false,
    applyProduction: false,
    databaseId: DEFAULT_DATABASE_ID,
    reportDir: DEFAULT_REPORT_DIR,
    batchSize: DEFAULT_BATCH_SIZE,
    resumeFrom: null,
    limit: null,
    expectedDocumentCount: null,
    ...rawOptions,
  };
  validateOptions(options);
  const backup = await loadBackup(options.backupPath);
  if (backup.manifest.projectId !== options.projectId) {
    throw new Error(`Backup projectId mismatch. Expected ${options.projectId}, got ${backup.manifest.projectId}.`);
  }
  if (backup.manifest.databaseId !== options.databaseId) {
    throw new Error(`Backup databaseId mismatch. Expected ${options.databaseId}, got ${backup.manifest.databaseId}.`);
  }
  if (options.expectedDocumentCount !== null && backup.manifest.totalDocuments !== options.expectedDocumentCount) {
    throw new Error(`Backup document count mismatch. Expected ${options.expectedDocumentCount}, got ${backup.manifest.totalDocuments}.`);
  }

  const collectionBreakdown = buildCollectionBreakdown({
    manifest: backup.manifest,
    collections: backup.collections,
    ownerUidTarget: options.ownerUid,
  });
  const documentAudit = buildDocumentAudit({ collections: backup.collections, ownerUidTarget: options.ownerUid });
  const plannedOperations = buildPlannedOperations({
    documentAudit,
    ownerUidTarget: options.ownerUid,
    resumeFrom: options.resumeFrom,
    limit: options.limit,
  });
  const inScopeDocuments = documentAudit.filter((document) => PROTECTED_COLLECTIONS.includes(document.collection));
  const blockingIssues = [];
  const warnings = [];

  const conflictingOwnerUid = inScopeDocuments.filter((document) => document.classification === "CONFLICTING_OWNERUID").length;
  const invalidOwnerUidType = inScopeDocuments.filter((document) => document.classification === "INVALID_OWNERUID_TYPE").length;
  const manualReviewRequired = inScopeDocuments.filter((document) => document.classification === "MANUAL_REVIEW_REQUIRED").length;
  if (conflictingOwnerUid > 0) {
    const message = `${conflictingOwnerUid} documents have a conflicting ownerUid.`;
    if (options.fixtureReviewMode) warnings.push(`Fixture review issue: ${message}`);
    else blockingIssues.push(message);
  }
  if (invalidOwnerUidType > 0) {
    const message = `${invalidOwnerUidType} documents have invalid ownerUid types.`;
    if (options.fixtureReviewMode) warnings.push(`Fixture review issue: ${message}`);
    else blockingIssues.push(message);
  }
  if (manualReviewRequired > 0) blockingIssues.push(`${manualReviewRequired} documents require manual review.`);
  if (OUT_OF_SCOPE_COLLECTIONS_TO_REVIEW.some((name) => backup.collections.has(name))) {
    warnings.push("Out-of-scope historical collections detected: fraisFixes, parametres and/or tickets. They are not migrated in this sprint.");
  }

  const batchEstimate = estimateBatches(plannedOperations.length, options.batchSize);
  const report = {
    generatedAt: new Date().toISOString(),
    projectId: options.projectId,
    databaseId: options.databaseId,
    backupPath: backup.backupPath,
    ownerUidTarget: options.ownerUid,
    dryRun: !(options.apply || options.applyProduction),
    apply: options.apply || options.applyProduction,
    productionWrites: 0,
    emulatorWrites: 0,
    collectionsScanned: collectionBreakdown.length,
    documentsScanned: backup.manifest.totalDocuments,
    documentsInScope: inScopeDocuments.length,
    migratableDocuments: plannedOperations.length,
    alreadyCompliant: inScopeDocuments.filter((document) => document.classification === "ALREADY_COMPLIANT").length,
    conflictingOwnerUid,
    invalidOwnerUidType,
    manualReviewRequired,
    outOfScopeDocuments: documentAudit.filter((document) => document.classification === "OUT_OF_SCOPE").length,
    collectionBreakdown,
    documentAudit,
    plannedOperations,
    estimatedBatchCount: batchEstimate.estimatedBatchCount,
    batchEstimate,
    expectedFinalCompliantCount: inScopeDocuments.filter((document) => ["ALREADY_COMPLIANT", "MIGRATABLE_MISSING_OWNERUID"].includes(document.classification)).length,
    blockingIssues,
    warnings,
    outOfScopeRecommendation: OUT_OF_SCOPE_COLLECTIONS_TO_REVIEW.map((collection) => ({
      collection,
      recommendation: "Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.",
    })),
    beforeAfterInvariant: "For every migrated document, after.data must equal before.data plus { ownerUid: ownerUidTarget } only.",
    verdict: blockingIssues.length === 0 ? "DRY_RUN_OWNERUID_READY_FOR_EMULATOR_VALIDATION" : "DRY_RUN_OWNERUID_BLOCKED",
  };
  return report;
}

function deserializeFirestoreValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => deserializeFirestoreValue(entry));
  }
  if (value && typeof value === "object") {
    if (value.__firestoreType === "timestamp") {
      return new Timestamp(value.seconds, value.nanoseconds);
    }
    if (value.__firestoreType === "date") {
      return new Date(value.iso);
    }
    if (value.__firestoreType === "geopoint") {
      return new GeoPoint(value.latitude, value.longitude);
    }
    if (value.__firestoreType === "bytes") {
      return Buffer.from(value.base64, "base64");
    }
    if (value.__firestoreType === "documentReference") {
      return value.path;
    }
    if (value.__firestoreType === "number") {
      if (value.value === "NaN") return Number.NaN;
      if (value.value === "Infinity") return Number.POSITIVE_INFINITY;
      if (value.value === "-Infinity") return Number.NEGATIVE_INFINITY;
    }
    return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "__firestoreType").map(([key, entry]) => [key, deserializeFirestoreValue(entry)]));
  }
  return value;
}

async function getDb(projectId) {
  if (!getApps().length) {
    let credential;
    try {
      const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
      credential = cert(serviceAccount);
    } catch {
      credential = undefined;
    }
    initializeApp({ projectId, ...(credential ? { credential } : {}) });
  }
  return getFirestore();
}

async function getProductionDb(projectId, databaseId) {
  if (!getApps().length) {
    let credential;
    try {
      const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
      credential = cert(serviceAccount);
    } catch {
      credential = undefined;
    }
    initializeApp({ projectId, ...(credential ? { credential } : {}) });
  }
  return getFirestore(getApps()[0], databaseId);
}

export async function verifyProductionState({ db, backup, report, options }) {
  const collectionNames = [...new Set([...PROTECTED_COLLECTIONS, ...(backup.manifest.collectionsExported || [])])].sort();
  let totalDocuments = 0;
  let documentsInScope = 0;
  let ownerUidPresent = 0;
  let targetOwnerUidPresent = 0;
  const differences = [];

  for (const collectionName of collectionNames) {
    const snapshot = await db.collection(collectionName).get();
    const documents = snapshot.docs || [];
    const backupDocuments = flattenDocuments(backup.collections.get(collectionName) || { documents: [] });
    const serverIds = documents.map((document) => document.id).sort();
    const backupIds = backupDocuments.map((document) => document.id).sort();
    totalDocuments += documents.length;

    if (stableJson(serverIds) !== stableJson(backupIds)) {
      differences.push(`${collectionName}: server document ids differ from backup`);
    }
    if (PROTECTED_COLLECTIONS.includes(collectionName)) {
      documentsInScope += documents.length;
      for (const document of documents) {
        const data = document.data() || {};
        if (Object.hasOwn(data, "ownerUid")) {
          ownerUidPresent += 1;
          if (data.ownerUid === options.ownerUid) targetOwnerUidPresent += 1;
          else differences.push(`${document.ref?.path || `${collectionName}/${document.id}`}: conflicting ownerUid`);
        }
      }
    }
  }

  const backupOwnerUidPresent = report.alreadyCompliant + report.conflictingOwnerUid + report.invalidOwnerUidType;
  if (totalDocuments !== options.expectedDocumentCount) differences.push(`total documents: expected ${options.expectedDocumentCount}, got ${totalDocuments}`);
  if (documentsInScope !== report.documentsInScope) differences.push(`in-scope documents: expected ${report.documentsInScope}, got ${documentsInScope}`);
  if (ownerUidPresent !== backupOwnerUidPresent) differences.push(`ownerUid present: expected ${backupOwnerUidPresent}, got ${ownerUidPresent}`);
  if (targetOwnerUidPresent !== report.alreadyCompliant) differences.push(`target ownerUid present: expected ${report.alreadyCompliant}, got ${targetOwnerUidPresent}`);
  if (differences.length) throw new Error(`Production preflight mismatch. No writes performed. ${differences.join("; ")}`);

  return { projectId: options.projectId, databaseId: options.databaseId, totalDocuments, documentsInScope, ownerUidPresent, targetOwnerUidPresent };
}

export async function requestProductionConfirmation({ report, options, input = process.stdin, output = process.stdout }) {
  output.write(`****************************************\n\nPRODUCTION MIGRATION\n\nProject : ${options.projectId}\nDatabase : ${options.databaseId}\nDocuments : ${report.documentsScanned}\nOwner UID : ${options.ownerUid}\nDocuments à modifier : ${report.migratableDocuments}\nBatch size : ${options.batchSize}\n\n****************************************\n`);
  const readline = createInterface({ input, output });
  try {
    return (await readline.question("Type YES to continue: ")) === "YES";
  } finally {
    readline.close();
  }
}

async function seedBackupIntoEmulator({ db, backup }) {
  for (const collectionPayload of backup.collections.values()) {
    for (const document of flattenDocuments(collectionPayload)) {
      await db.doc(document.path).set(deserializeFirestoreValue(document.data || {}));
    }
  }
}

async function applyOperationsToEmulator({ db, plannedOperations, batchSize, simulateInterruptAfterBatches = null }) {
  let writes = 0;
  let batchesCommitted = 0;
  const appliedOperations = [];
  const pendingOperations = [];
  for (const operation of plannedOperations) {
    const snapshot = await db.doc(operation.path).get();
    const data = snapshot.data() || {};
    if (!Object.hasOwn(data, "ownerUid")) {
      pendingOperations.push(operation);
    }
  }
  for (let index = 0; index < pendingOperations.length; index += batchSize) {
    const batch = db.batch();
    const chunk = pendingOperations.slice(index, index + batchSize);
    for (const operation of chunk) {
      batch.update(db.doc(operation.path), operation.patch);
    }
    await batch.commit();
    writes += chunk.length;
    appliedOperations.push(...chunk);
    batchesCommitted += 1;
    if (simulateInterruptAfterBatches !== null && batchesCommitted >= simulateInterruptAfterBatches) {
      const error = new Error("Simulated interruption after batch commit.");
      error.partialWrites = writes;
      error.appliedOperations = appliedOperations;
      error.resumeFrom = pendingOperations[index + chunk.length]?.path || null;
      throw error;
    }
  }
  return { writes, batchesCommitted, appliedOperations };
}

async function writeReportFiles(report, options) {
  const reportDir = resolve(process.cwd(), options.reportDir);
  await mkdir(reportDir, { recursive: true });
  const jsonPath = resolve(reportDir, options.reportName);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdownPath = resolve(process.cwd(), options.markdownName);
  await writeFile(markdownPath, renderMarkdownReport(report), "utf8");
  return { jsonPath, markdownPath };
}

function renderMarkdownReport(report) {
  const scopeRows = report.collectionBreakdown
    .map((entry) => `| ${entry.collection} | ${entry.category} | ${entry.totalDocuments} | ${entry.MIGRATABLE_MISSING_OWNERUID} | ${entry.ALREADY_COMPLIANT} | ${entry.CONFLICTING_OWNERUID} | ${entry.INVALID_OWNERUID_TYPE} |`)
    .join("\n");
  return `# OwnerUid Migration Dry-Run

## Resume

- Date: ${report.generatedAt}
- Project ID: ${report.projectId}
- Database ID: ${report.databaseId}
- Backup: ${report.backupPath}
- UID cible: ${report.ownerUidTarget}
- Mode par defaut: DRY-RUN
- Ecritures production: ${report.productionWrites}
- Verdict: ${report.verdict}

## Perimetre

| Collection | Categorie | Documents | Migratables | Deja conformes | Conflits | Types invalides |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
${scopeRows}

## Patch simule

\`\`\`json
{
  "ownerUid": "${report.ownerUidTarget}"
}
\`\`\`

Champs metier modifies: AUCUN.

## Batches

- Documents migratables: ${report.migratableDocuments}
- Taille batch: ${report.batchEstimate.batchSize}
- Nombre de batches: ${report.estimatedBatchCount}
- Derniere batch: ${report.batchEstimate.lastBatchSize}
- Nombre exact d'ecritures futures: ${report.batchEstimate.exactWriteCount}

## Collections hors perimetre

${report.outOfScopeRecommendation.map((entry) => `- ${entry.collection}: ${entry.recommendation}`).join("\n")}

## Bloquants

${report.blockingIssues.length ? report.blockingIssues.map((issue) => `- ${issue}`).join("\n") : "- Aucun bloqueur detecte dans le backup analyse."}

## Warnings

${report.warnings.length ? report.warnings.map((warning) => `- ${warning}`).join("\n") : "- Aucun warning."}

## Interdictions respectees

- Migration production: NON EFFECTUEE
- Deploiement Firestore Rules: NON EFFECTUE
- Deploiement Hosting: NON EFFECTUE
- Documents Firestore production modifies: 0
`;
}

export async function runMigrationCli(argv = process.argv.slice(2), dependencies = {}) {
  const options = parseArgs(argv);
  if (options.seedFixture && options.fixturePath) {
    options.backupPath = options.fixturePath;
  }
  validateOptions(options);
  const report = await buildMigrationReport(options);

  if (options.applyProduction) {
    if (report.blockingIssues.length) {
      throw new Error(`Production migration blocked. ${report.blockingIssues.join("; ")}`);
    }
    const startedAt = Date.now();
    const backup = await loadBackup(options.backupPath);
    const db = dependencies.productionDb || await (dependencies.getProductionDb || getProductionDb)(options.projectId, options.databaseId);
    await verifyProductionState({ db, backup, report, options });
    const confirmed = dependencies.confirmProduction
      ? await dependencies.confirmProduction({ report, options })
      : await requestProductionConfirmation({ report, options });
    if (!confirmed) {
      throw new Error("Production migration cancelled. Exact confirmation YES was not provided. No writes performed.");
    }
    try {
      const result = await applyOperationsToEmulator({
        db,
        plannedOperations: report.plannedOperations,
        batchSize: options.batchSize,
        simulateInterruptAfterBatches: options.simulateInterruptAfterBatches,
      });
      report.production = true;
      report.timestamp = new Date(startedAt).toISOString();
      report.duration = Date.now() - startedAt;
      report.productionWrites = result.writes;
      report.appliedOperations = result.appliedOperations;
      report.dryRun = false;
      report.verdict = "PRODUCTION_OWNERUID_MIGRATION_APPLIED";
    } catch (error) {
      report.production = true;
      report.timestamp = new Date(startedAt).toISOString();
      report.duration = Date.now() - startedAt;
      report.productionWrites = error.partialWrites || 0;
      report.appliedOperations = error.appliedOperations || [];
      report.resumeCursor = error.resumeFrom || null;
      report.blockingIssues.push(error.message);
      report.verdict = "PRODUCTION_OWNERUID_MIGRATION_INTERRUPTED";
      const paths = await writeReportFiles(report, options);
      console.log(`OwnerUid report written: ${paths.jsonPath}`);
      throw error;
    }
  } else if (options.apply) {
    const backup = await loadBackup(options.backupPath);
    const db = await getDb(options.projectId);
    if (options.seedFixture) {
      await seedBackupIntoEmulator({ db, backup });
    }
    try {
      const result = await applyOperationsToEmulator({
        db,
        plannedOperations: report.plannedOperations,
        batchSize: options.batchSize,
        simulateInterruptAfterBatches: options.simulateInterruptAfterBatches,
      });
      report.emulatorWrites = result.writes;
      report.appliedOperations = result.appliedOperations;
      report.dryRun = false;
      report.productionWrites = 0;
      report.verdict = report.blockingIssues.length === 0 ? "EMULATOR_OWNERUID_MIGRATION_APPLIED" : "EMULATOR_OWNERUID_MIGRATION_BLOCKED";
    } catch (error) {
      report.emulatorWrites = error.partialWrites || 0;
      report.appliedOperations = error.appliedOperations || [];
      report.resumeCursor = error.resumeFrom || null;
      report.blockingIssues.push(error.message);
      report.verdict = "EMULATOR_OWNERUID_MIGRATION_INTERRUPTED";
      const paths = await writeReportFiles(report, options);
      console.log(`OwnerUid report written: ${paths.jsonPath}`);
      throw error;
    }
  }

  const paths = await writeReportFiles(report, options);
  console.log(`OwnerUid migration report written: ${paths.jsonPath}`);
  console.log(`OwnerUid migration markdown written: ${paths.markdownPath}`);
  console.log(`Verdict: ${report.verdict}`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  runMigrationCli().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
