import process from "node:process";
import { cp, mkdir, readFile, rename, writeFile, rm } from "node:fs/promises";
import { resolve, join } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const EXPECTED_PROJECT_ID = "budget-alexandre";
const DATABASE_ID = "(default)";
const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const BACKUP_ROOT = resolve(process.cwd(), "backups/firestore");
const FORMAT_VERSION = "firestore-backup-v1";

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
}

function sanitizeFileName(name = "") {
  return String(name || "collection").replace(/[^a-zA-Z0-9._-]/g, "_");
}

function wait(ms) {
  return new Promise((resolveWait) => {
    setTimeout(resolveWait, ms);
  });
}

async function renameWithRetry(sourcePath, targetPath, attempts = 5) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(sourcePath, targetPath);
      return;
    } catch (error) {
      lastError = error;

      if (attempt === attempts || !["EBUSY", "EPERM"].includes(error?.code)) {
        break;
      }

      await wait(250 * attempt);
    }
  }

  throw lastError;
}

async function finalizeFolder(sourcePath, targetPath) {
  try {
    await renameWithRetry(sourcePath, targetPath);
    return;
  } catch (error) {
    if (!["EBUSY", "EPERM"].includes(error?.code)) {
      throw error;
    }

    await cp(sourcePath, targetPath, { recursive: true, force: false, errorOnExist: true });
    await rm(sourcePath, { recursive: true, force: true });
  }
}

function isPlainObject(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializeNumber(value) {
  if (Number.isNaN(value)) {
    return { __firestoreType: "number", value: "NaN" };
  }

  if (!Number.isFinite(value)) {
    return { __firestoreType: "number", value: value > 0 ? "Infinity" : "-Infinity" };
  }

  return value;
}

function serializeFirestoreValue(value) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return serializeNumber(value);
  }

  if (typeof value === "bigint") {
    return {
      __firestoreType: "bigint",
      value: String(value),
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeFirestoreValue(entry));
  }

  if (Buffer.isBuffer(value)) {
    return {
      __firestoreType: "bytes",
      base64: value.toString("base64"),
    };
  }

  if (value instanceof Uint8Array) {
    return {
      __firestoreType: "bytes",
      base64: Buffer.from(value).toString("base64"),
    };
  }

  if (typeof value?.toBase64 === "function") {
    return {
      __firestoreType: "bytes",
      base64: value.toBase64(),
    };
  }

  if (
    value
    && typeof value?.toDate === "function"
    && typeof value?.seconds === "number"
    && typeof value?.nanoseconds === "number"
  ) {
    return {
      __firestoreType: "timestamp",
      seconds: value.seconds,
      nanoseconds: value.nanoseconds,
      iso: value.toDate().toISOString(),
    };
  }

  if (
    value
    && typeof value?.latitude === "number"
    && typeof value?.longitude === "number"
    && value?.constructor?.name === "GeoPoint"
  ) {
    return {
      __firestoreType: "geopoint",
      latitude: value.latitude,
      longitude: value.longitude,
    };
  }

  if (
    value
    && typeof value?.path === "string"
    && typeof value?.id === "string"
    && value?.constructor?.name === "DocumentReference"
  ) {
    return {
      __firestoreType: "documentReference",
      path: value.path,
      id: value.id,
      parentPath: value?.parent?.path || null,
      firestoreDatabaseId: DATABASE_ID,
    };
  }

  if (value instanceof Date) {
    return {
      __firestoreType: "date",
      iso: value.toISOString(),
    };
  }

  if (isPlainObject(value)) {
    const output = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      output[key] = serializeFirestoreValue(nestedValue);
    }
    return output;
  }

  return {
    __firestoreType: "unknown",
    constructorName: value?.constructor?.name || "unknown",
    value: String(value),
  };
}

function serializeSnapshotTime(snapshotTime) {
  if (!snapshotTime || typeof snapshotTime?.toDate !== "function") {
    return null;
  }

  return {
    __firestoreType: "timestamp",
    seconds: snapshotTime.seconds,
    nanoseconds: snapshotTime.nanoseconds,
    iso: snapshotTime.toDate().toISOString(),
  };
}

async function exportCollectionRecursive(collectionRef, context, rootSummary) {
  const snapshot = await collectionRef.get();
  const documents = [];

  for (const docSnap of snapshot.docs) {
    context.totalDocuments += 1;
    rootSummary.totalDocumentsIncludingSubcollections += 1;

    const subcollectionRefs = await docSnap.ref.listCollections();
    const subcollections = {};

    for (const subcollectionRef of subcollectionRefs) {
      rootSummary.subcollectionsDetected.add(subcollectionRef.id);
      subcollections[subcollectionRef.id] = await exportCollectionRecursive(subcollectionRef, context, rootSummary);
    }

    documents.push({
      id: docSnap.id,
      path: docSnap.ref.path,
      createTime: serializeSnapshotTime(docSnap.createTime),
      updateTime: serializeSnapshotTime(docSnap.updateTime),
      readTime: serializeSnapshotTime(docSnap.readTime),
      data: serializeFirestoreValue(docSnap.data()),
      subcollections,
    });
  }

  return {
    id: collectionRef.id,
    path: collectionRef.path,
    documentCount: snapshot.size,
    documents,
  };
}

function buildManifestBase({ projectId, databaseId, startedAtUtc }) {
  return {
    formatVersion: FORMAT_VERSION,
    startedAtUtc,
    finishedAtUtc: null,
    result: "failure",
    projectId,
    databaseId,
    rootCollectionsCount: 0,
    totalDocuments: 0,
    documentsPerCollection: {},
    collectionsExported: [],
    collectionsWithSubcollectionsDetected: {},
    outputFolder: null,
    error: null,
  };
}

async function safeReadServiceAccount() {
  const raw = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
  const parsed = JSON.parse(raw);

  if (parsed?.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(
      `Service account project_id mismatch. Expected '${EXPECTED_PROJECT_ID}', received '${parsed?.project_id || "<missing>"}'.`
    );
  }

  return parsed;
}

async function main() {
  const startedAt = new Date();
  const startedAtUtc = startedAt.toISOString();
  const tmpFolderName = `.tmp-${timestampForPath(startedAt)}-${process.pid}`;
  const tmpPath = resolve(BACKUP_ROOT, tmpFolderName);
  const collectionsPath = resolve(tmpPath, "collections");

  await mkdir(collectionsPath, { recursive: true });

  const serviceAccount = await safeReadServiceAccount();

  console.log("Firestore backup (read-only)");
  console.log(`- projectId: ${serviceAccount.project_id}`);
  console.log(`- databaseId: ${DATABASE_ID}`);
  console.log(`- target root: ${BACKUP_ROOT}`);

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  const db = getFirestore(app);
  const context = {
    totalDocuments: 0,
  };

  const manifest = buildManifestBase({
    projectId: serviceAccount.project_id,
    databaseId: DATABASE_ID,
    startedAtUtc,
  });

  try {
    const rootCollections = await db.listCollections();

    for (const rootCollectionRef of rootCollections) {
      const rootSummary = {
        rootDocumentCount: 0,
        totalDocumentsIncludingSubcollections: 0,
        subcollectionsDetected: new Set(),
      };

      const rootSnapshot = await rootCollectionRef.get();
      rootSummary.rootDocumentCount = rootSnapshot.size;

      const exportedCollection = await exportCollectionRecursive(rootCollectionRef, context, rootSummary);
      const outputFilePath = join(collectionsPath, `${sanitizeFileName(rootCollectionRef.id)}.json`);
      await writeFile(outputFilePath, `${JSON.stringify(exportedCollection, null, 2)}\n`, "utf8");

      manifest.documentsPerCollection[rootCollectionRef.id] = {
        rootDocumentCount: rootSummary.rootDocumentCount,
        totalDocumentsIncludingSubcollections: rootSummary.totalDocumentsIncludingSubcollections,
      };
      manifest.collectionsWithSubcollectionsDetected[rootCollectionRef.id] = Array.from(rootSummary.subcollectionsDetected).sort();
      manifest.collectionsExported.push(rootCollectionRef.id);
    }

    manifest.rootCollectionsCount = manifest.collectionsExported.length;
    manifest.totalDocuments = context.totalDocuments;
    manifest.result = "success";
    manifest.finishedAtUtc = new Date().toISOString();

    const finalFolderName = timestampForPath(new Date());
    const finalPath = resolve(BACKUP_ROOT, finalFolderName);
    manifest.outputFolder = finalPath;

    await writeFile(resolve(tmpPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await finalizeFolder(tmpPath, finalPath);

    console.log("Backup completed successfully.");
    console.log(`- output: ${finalPath}`);
    console.log(`- root collections: ${manifest.rootCollectionsCount}`);
    console.log(`- total documents: ${manifest.totalDocuments}`);
  } catch (error) {
    manifest.result = "failure";
    manifest.finishedAtUtc = new Date().toISOString();
    manifest.error = {
      message: error?.message || String(error),
      stack: error?.stack || null,
    };

    try {
      await writeFile(resolve(tmpPath, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    } catch {
      // Ignore secondary write errors while preserving failure state.
    }

    const failedPath = resolve(BACKUP_ROOT, `FAILED-${timestampForPath(new Date())}`);

    try {
      await finalizeFolder(tmpPath, failedPath);
      console.error(`Backup failed. Evidence folder: ${failedPath}`);
    } catch {
      await rm(tmpPath, { recursive: true, force: true });
      console.error("Backup failed and temp folder cleanup attempted.");
    }

    throw error;
  }
}

main().catch((error) => {
  console.error("Firestore backup failed.");
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
