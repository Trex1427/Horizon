import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Readable, Writable } from "node:stream";
import {
  buildMigrationReport,
  DEFAULT_DATABASE_ID,
  requestProductionConfirmation,
  runMigrationCli,
} from "./migrate-owner-uid.mjs";
import { buildRollbackPlan } from "./rollback-owner-uid.mjs";

const OWNER_UID = "ownerUidFixture123";
const PROJECT_ID = "budget-alexandre";

async function writeBackup(collections) {
  const root = await mkdtemp(join(tmpdir(), "owneruid-backup-"));
  const collectionsPath = join(root, "collections");
  await mkdir(collectionsPath, { recursive: true });
  const documentsPerCollection = {};
  const collectionsExported = [];
  let totalDocuments = 0;

  for (const [collection, documents] of Object.entries(collections)) {
    collectionsExported.push(collection);
    totalDocuments += documents.length;
    documentsPerCollection[collection] = {
      rootDocumentCount: documents.length,
      totalDocumentsIncludingSubcollections: documents.length,
    };
    await writeFile(join(collectionsPath, `${collection}.json`), `${JSON.stringify({
      id: collection,
      path: collection,
      documentCount: documents.length,
      documents: documents.map((document) => ({
        id: document.id,
        path: `${collection}/${document.id}`,
        createTime: { __firestoreType: "timestamp", seconds: 1, nanoseconds: 0, iso: "1970-01-01T00:00:01.000Z" },
        updateTime: { __firestoreType: "timestamp", seconds: 1, nanoseconds: 0, iso: "1970-01-01T00:00:01.000Z" },
        readTime: { __firestoreType: "timestamp", seconds: 2, nanoseconds: 0, iso: "1970-01-01T00:00:02.000Z" },
        data: document.data,
        subcollections: document.subcollections || {},
      })),
    }, null, 2)}\n`, "utf8");
  }

  await writeFile(join(root, "manifest.json"), `${JSON.stringify({
    formatVersion: "firestore-backup-v1",
    startedAtUtc: "2026-07-17T00:00:00.000Z",
    finishedAtUtc: "2026-07-17T00:00:01.000Z",
    result: "success",
    projectId: PROJECT_ID,
    databaseId: DEFAULT_DATABASE_ID,
    rootCollectionsCount: collectionsExported.length,
    totalDocuments,
    documentsPerCollection,
    collectionsExported,
    collectionsWithSubcollectionsDetected: Object.fromEntries(collectionsExported.map((name) => [name, []])),
    outputFolder: root,
    error: null,
  }, null, 2)}\n`, "utf8");

  return root;
}

function baseOptions(backupPath, overrides = {}) {
  return {
    ownerUid: OWNER_UID,
    projectId: PROJECT_ID,
    databaseId: DEFAULT_DATABASE_ID,
    backupPath,
    batchSize: 2,
    ...overrides,
  };
}

test("requires an explicit valid ownerUid", async () => {
  const backupPath = await writeBackup({ accounts: [] });
  await assert.rejects(
    () => buildMigrationReport(baseOptions(backupPath, { ownerUid: undefined })),
    /Missing --owner-uid/
  );
  await assert.rejects(
    () => buildMigrationReport(baseOptions(backupPath, { ownerUid: "bad uid" })),
    /must not contain whitespace/
  );
});

test("requires explicit projectId, backup and matching expected count", async () => {
  const backupPath = await writeBackup({ accounts: [{ id: "a", data: {} }] });
  await assert.rejects(
    () => buildMigrationReport(baseOptions(backupPath, { projectId: undefined })),
    /Missing explicit --project-id/
  );
  await assert.rejects(
    () => buildMigrationReport(baseOptions(undefined)),
    /Missing --backup-path/
  );
  await assert.rejects(
    () => buildMigrationReport(baseOptions(backupPath, { expectedDocumentCount: 2 })),
    /Backup document count mismatch/
  );
});

test("dry-run is the default and production apply is blocked", async () => {
  const backupPath = await writeBackup({ accounts: [{ id: "missing", data: { name: "A" } }] });
  const report = await buildMigrationReport(baseOptions(backupPath));
  assert.equal(report.dryRun, true);
  assert.equal(report.productionWrites, 0);
  await assert.rejects(
    () => buildMigrationReport(baseOptions(backupPath, { apply: true, dryRun: false })),
    /Production apply is blocked/
  );
});

test("classifies migratable, compliant, conflicting, invalid and out-of-scope documents", async () => {
  const backupPath = await writeBackup({
    accounts: [
      { id: "missing", data: { name: "missing-owner" } },
      { id: "compliant", data: { ownerUid: OWNER_UID, name: "ok" } },
      { id: "conflict", data: { ownerUid: "otherOwner123", name: "conflict" } },
      { id: "invalid-null", data: { ownerUid: null, name: "invalid" } },
      { id: "invalid-number", data: { ownerUid: 42, name: "invalid" } },
      { id: "invalid-array", data: { ownerUid: [OWNER_UID], name: "invalid" } },
    ],
    fraisFixes: [{ id: "legacy", data: { name: "legacy" } }],
  });
  const report = await buildMigrationReport(baseOptions(backupPath));

  assert.equal(report.documentsScanned, 7);
  assert.equal(report.documentsInScope, 6);
  assert.equal(report.migratableDocuments, 1);
  assert.equal(report.alreadyCompliant, 1);
  assert.equal(report.conflictingOwnerUid, 1);
  assert.equal(report.invalidOwnerUidType, 3);
  assert.equal(report.outOfScopeDocuments, 1);
  assert.equal(report.plannedOperations.length, 1);
  assert.deepEqual(report.plannedOperations[0].patch, { ownerUid: OWNER_UID });
  assert.ok(report.blockingIssues.some((issue) => issue.includes("conflicting ownerUid")));
  assert.ok(report.blockingIssues.some((issue) => issue.includes("invalid ownerUid")));
});

test("preserves business fields by planning only an ownerUid patch", async () => {
  const richData = {
    name: "Rich document",
    amount: 123.45,
    tags: ["a", "b"],
    nested: { createdAt: "2026-07-17", ref: { __firestoreType: "documentReference", path: "accounts/a", id: "a" } },
    timestamp: { __firestoreType: "timestamp", seconds: 1, nanoseconds: 2, iso: "1970-01-01T00:00:01.000Z" },
  };
  const backupPath = await writeBackup({ transactions: [{ id: "rich", data: richData }] });
  const report = await buildMigrationReport(baseOptions(backupPath));
  assert.deepEqual(Object.keys(report.plannedOperations[0].patch), ["ownerUid"]);
  assert.equal(report.documentAudit[0].documentReferences.length, 1);
  assert.equal(report.documentAudit[0].timestamps.length, 1);
});

test("computes batches, limit, resume cursor and idempotence after first migration state", async () => {
  const backupPath = await writeBackup({
    accounts: [
      { id: "a", data: {} },
      { id: "b", data: {} },
      { id: "c", data: {} },
      { id: "d", data: {} },
      { id: "e", data: {} },
    ],
  });
  const report = await buildMigrationReport(baseOptions(backupPath));
  assert.equal(report.migratableDocuments, 5);
  assert.equal(report.estimatedBatchCount, 3);
  assert.equal(report.batchEstimate.lastBatchSize, 1);

  const limited = await buildMigrationReport(baseOptions(backupPath, { limit: 2 }));
  assert.equal(limited.plannedOperations.length, 2);
  const resumed = await buildMigrationReport(baseOptions(backupPath, { resumeFrom: report.plannedOperations[2].path }));
  assert.equal(resumed.plannedOperations[0].path, report.plannedOperations[2].path);

  const afterBackupPath = await writeBackup({
    accounts: ["a", "b", "c", "d", "e"].map((id) => ({ id, data: { ownerUid: OWNER_UID } })),
  });
  const afterReport = await buildMigrationReport(baseOptions(afterBackupPath));
  assert.equal(afterReport.migratableDocuments, 0);
  assert.equal(afterReport.alreadyCompliant, 5);
});

test("rollback plan targets only documents written by the migration and second rollback has no extra writes", () => {
  const report = {
    emulatorWrites: 2,
    plannedOperations: [
      { path: "accounts/a", patch: { ownerUid: OWNER_UID } },
      { path: "accounts/b", patch: { ownerUid: OWNER_UID } },
      { path: "accounts/c", patch: { ownerUid: OWNER_UID } },
    ],
  };
  const plan = buildRollbackPlan(report);
  assert.equal(plan.writeCount, 2);
  assert.deepEqual(plan.rollbackTargets.map((operation) => operation.path), ["accounts/a", "accounts/b"]);
  assert.equal(plan.secondRollbackWouldWrite, 0);
});

function createMockProductionDb(initialDocuments) {
  const store = new Map(Object.entries(initialDocuments));
  const docRef = (path) => ({
    path,
    async get() {
      const data = store.get(path);
      return { data: () => data };
    },
  });
  return {
    store,
    collection(name) {
      const docs = [...store.entries()]
        .filter(([path]) => path.startsWith(`${name}/`) && path.split("/").length === 2)
        .map(([path, data]) => ({ id: path.split("/")[1], ref: { path }, data: () => data }));
      return { get: async () => ({ docs }) };
    },
    doc: docRef,
    batch() {
      const updates = [];
      return {
        update(ref, patch) { updates.push([ref.path, patch]); },
        async commit() {
          for (const [path, patch] of updates) store.set(path, { ...store.get(path), ...patch });
        },
      };
    },
  };
}

test("production mode requires explicit safeguards and applies only ownerUid with mocked Firestore", async () => {
  const backupPath = await writeBackup({ accounts: [{ id: "a", data: { name: "A" } }] });
  const reportDir = await mkdtemp(join(tmpdir(), "owneruid-report-"));
  const db = createMockProductionDb({ "accounts/a": { name: "A" } });
  const commonArgs = [
    "--apply-production",
    `--owner-uid=${OWNER_UID}`,
    `--project-id=${PROJECT_ID}`,
    `--confirm-project-id=${PROJECT_ID}`,
    `--database-id=${DEFAULT_DATABASE_ID}`,
    `--backup-path=${backupPath}`,
    "--expected-document-count=1",
    `--report-dir=${reportDir}`,
    "--report-name=production.json",
    `--markdown-name=${join(reportDir, "production.md")}`,
    "--batch-size=2",
  ];
  const report = await runMigrationCli(commonArgs, { productionDb: db, confirmProduction: async () => true });

  assert.equal(report.production, true);
  assert.equal(report.productionWrites, 1);
  assert.equal(typeof report.timestamp, "string");
  assert.equal(typeof report.duration, "number");
  assert.deepEqual(db.store.get("accounts/a"), { name: "A", ownerUid: OWNER_UID });

  await assert.rejects(
    () => runMigrationCli(commonArgs.filter((arg) => !arg.startsWith("--confirm-project-id=")), { productionDb: db, confirmProduction: async () => true }),
    /requires --confirm-project-id/,
  );
});

test("production confirmation accepts exactly YES and rejects an empty answer", async () => {
  const output = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  const report = { documentsScanned: 1, migratableDocuments: 1 };
  const options = { projectId: PROJECT_ID, databaseId: DEFAULT_DATABASE_ID, ownerUid: OWNER_UID, batchSize: 2 };
  assert.equal(await requestProductionConfirmation({ report, options, input: Readable.from(["YES\n"]), output }), true);
  assert.equal(await requestProductionConfirmation({ report, options, input: Readable.from(["\n"]), output }), false);
});
