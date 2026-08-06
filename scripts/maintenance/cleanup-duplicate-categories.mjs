import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp as initializeClientApp } from "firebase/app";
import { collection as clientCollection, getDocs as clientGetDocs, getFirestore as clientGetFirestore, query as clientQuery } from "firebase/firestore";
import { assertAutomatedWriteAllowed } from "../safety/automatedWriteGuard.mjs";

const COLLECTION_NAME = "categories";
const DUPLICATE_REASON = "duplicate-category-cleanup";

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeCategoryType(value) {
  return normalizeCategoryName(value || "depense") || "depense";
}

function isResetCategoryId(id) {
  return String(id || "").startsWith("reset-");
}

function toMillis(value) {
  if (!value) return Number.POSITIVE_INFINITY;

  if (typeof value.toMillis === "function") {
    return value.toMillis();
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }

  if (typeof value === "number") {
    return value;
  }

  return Number.POSITIVE_INFINITY;
}

function getDocumentSortScore(category) {
  return [toMillis(category.createdAt), toMillis(category.updatedAt), category.id || ""];
}

function compareDocumentAges(left, right) {
  const [leftCreatedAt, leftUpdatedAt, leftId] = getDocumentSortScore(left);
  const [rightCreatedAt, rightUpdatedAt, rightId] = getDocumentSortScore(right);

  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;
  if (leftUpdatedAt !== rightUpdatedAt) return leftUpdatedAt - rightUpdatedAt;
  return leftId.localeCompare(rightId);
}

function parseArgs(argv) {
  return {
    apply: argv.includes("--apply"),
  };
}

function loadDotEnvValue(filePath, key) {
  try {
    const content = readFileSync(filePath, "utf8");
    const line = content
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${key}=`));

    if (!line) {
      return undefined;
    }

    return line.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

function groupCategories(categories) {
  const groups = new Map();

  for (const category of categories) {
    const ownerUid = String(category.ownerUid || "").trim();
    const nameKey = normalizeCategoryName(category.name);
    const typeKey = normalizeCategoryType(category.type || "depense");

    if (!ownerUid || !nameKey) {
      continue;
    }

    const groupKey = `${ownerUid}::${nameKey}::${typeKey}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey).push(category);
  }

  return groups;
}

export function buildDuplicatePlan(categories) {
  const groups = groupCategories(categories);
  const duplicateGroups = [];
  const toDelete = [];
  const remapByCategoryId = new Map();

  for (const [groupKey, groupCategoriesItems] of groups.entries()) {
    if (groupCategoriesItems.length < 2) {
      continue;
    }

    const sorted = [...groupCategoriesItems].sort((left, right) => {
      const leftReset = isResetCategoryId(left.id);
      const rightReset = isResetCategoryId(right.id);

      if (leftReset !== rightReset) {
        return leftReset ? 1 : -1;
      }

      return compareDocumentAges(left, right);
    });
    const keeper = sorted[0];
    const candidates = sorted.slice(1);

    duplicateGroups.push({
      key: groupKey,
      keeper,
      candidates,
    });

    for (const candidate of candidates) {
      toDelete.push(candidate);
      remapByCategoryId.set(candidate.id, {
        keeperId: keeper.id,
        keeperName: keeper.name || candidate.name || "",
        ownerUid: String(keeper.ownerUid || candidate.ownerUid || "").trim(),
      });
    }
  }

  return { duplicateGroups, toDelete, remapByCategoryId };
}

export function buildReferencePatch(documentData = {}, remap = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(documentData, "categoryId")) {
    patch.categoryId = remap.keeperId;
  }
  if (Object.prototype.hasOwnProperty.call(documentData, "categoryName")) {
    patch.categoryName = remap.keeperName;
  }
  if (Object.prototype.hasOwnProperty.call(documentData, "categorie")) {
    patch.categorie = remap.keeperName;
  }

  return patch;
}

function formatDate(value) {
  if (!value) return "n/a";

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const millis = toMillis(value);
  if (!Number.isFinite(millis)) return "n/a";

  return new Date(millis).toISOString();
}

async function loadFirebaseAdmin() {
  try {
    const appModule = await import("firebase-admin/app");
    const firestoreModule = await import("firebase-admin/firestore");
    return { ...appModule, ...firestoreModule };
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      console.error("Missing dependency: firebase-admin. Install it before running this maintenance script.");
      console.error("Example: npm install -D firebase-admin");
      process.exit(1);
    }

    throw error;
  }
}

function loadFirebaseClientConfig(envFilePath) {
  return {
    apiKey:
      process.env.VITE_FIREBASE_API_KEY ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_API_KEY"),
    authDomain:
      process.env.VITE_FIREBASE_AUTH_DOMAIN ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      loadDotEnvValue(envFilePath, "FIREBASE_PROJECT_ID") ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket:
      process.env.VITE_FIREBASE_STORAGE_BUCKET ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId:
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId:
      process.env.VITE_FIREBASE_APP_ID ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_APP_ID"),
  };
}

function hasAdminCredentials() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const envFilePath = resolve(process.cwd(), ".env");
  const clientConfig = loadFirebaseClientConfig(envFilePath);

  if (apply && !hasAdminCredentials()) {
    console.error("Refusing to run --apply without firebase-admin credentials (GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON).");
    process.exit(1);
  }

  if (apply) {
    assertAutomatedWriteAllowed({
      projectId: clientConfig.projectId,
      operationName: "maintenance:cleanup-duplicate-categories",
    });
  }

  let db;
  let useAdminBackend = false;

  if (apply) {
    const { initializeApp, getApps, applicationDefault, cert, getFirestore } = await loadFirebaseAdmin();
    const options = {};

    if (clientConfig.projectId) {
      options.projectId = clientConfig.projectId;
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      options.credential = cert(serviceAccount);
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      options.credential = applicationDefault();
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp(options);
    db = getFirestore(app);
    useAdminBackend = true;
  } else {
    if (!clientConfig.projectId || !clientConfig.apiKey || !clientConfig.appId) {
      console.error("Missing Firebase web config in environment/.env. Cannot run dry-run without a readable Firestore config.");
      process.exit(1);
    }

    const app = initializeClientApp(clientConfig);
    db = clientGetFirestore(app);
  }

  const snapshot = useAdminBackend
    ? await db.collection(COLLECTION_NAME).get()
    : await clientGetDocs(clientQuery(clientCollection(db, COLLECTION_NAME)));

  const categories = snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));

  const { duplicateGroups, toDelete, remapByCategoryId } = buildDuplicatePlan(categories);

  console.log(`Categories scanned: ${categories.length}`);
  console.log(`Duplicate groups detected: ${duplicateGroups.length}`);
  console.log(`Documents to delete: ${toDelete.length}`);
  console.log(`Reference updates required: ${remapByCategoryId.size}`);
  console.log("");

  if (duplicateGroups.length === 0) {
    console.log("No duplicate categories detected.");
    return;
  }

  for (const group of duplicateGroups) {
    const keeperLabel = `${group.keeper.name || "(no-name)"} / ${group.keeper.type || "depense"}`;
    console.log(`Group: ${group.key}`);
    console.log(`  Keep: ${group.keeper.id} (${keeperLabel}) createdAt=${formatDate(group.keeper.createdAt)}`);

    for (const candidate of group.candidates) {
      console.log(
        `  Would delete: ${candidate.id} (${candidate.name || "(no-name)"} / ${candidate.type || "depense"}) createdAt=${formatDate(candidate.createdAt)}`
      );
    }

    console.log("");
  }

  if (!apply) {
    console.log("Dry-run only. Re-run with --apply to remap references and delete the listed duplicate categories.");
    return;
  }

  if (toDelete.length === 0) {
    console.log("No active duplicate categories to update.");
    return;
  }

  let batch = db.batch();
  let batchSize = 0;
  let updatedReferenceCount = 0;

  const commitBatch = async () => {
    if (batchSize === 0) return;
    await batch.commit();
    batch = db.batch();
    batchSize = 0;
  };

  for (const collection of useAdminBackend ? await db.listCollections() : []) {
    if (collection.id === COLLECTION_NAME) {
      continue;
    }

    const snapshotForCollection = await collection.get();

    for (const document of snapshotForCollection.docs) {
      const data = document.data() || {};
      const ownerUid = String(data.ownerUid || "").trim();
      const categoryId = String(data.categoryId || "").trim();
      const remap = remapByCategoryId.get(categoryId);

      if (!ownerUid || !remap || (remap.ownerUid && remap.ownerUid !== ownerUid)) {
        continue;
      }

      const patch = buildReferencePatch(data, remap);

      if (Object.keys(patch).length === 0) {
        continue;
      }

      batch.update(document.ref, patch);
      batchSize += 1;
      updatedReferenceCount += 1;

      if (batchSize === 450) {
        await commitBatch();
      }
    }
  }

  await commitBatch();

  batch = db.batch();
  batchSize = 0;
  let deletedCount = 0;

  const commitDeleteBatch = async () => {
    if (batchSize === 0) return;
    await batch.commit();
    batch = db.batch();
    batchSize = 0;
  };

  for (const category of toDelete) {
    batch.delete(db.collection(COLLECTION_NAME).doc(category.id));

    batchSize += 1;
    deletedCount += 1;

    if (batchSize === 450) {
      await commitDeleteBatch();
    }
  }

  await commitDeleteBatch();

  console.log(`Updated ${updatedReferenceCount} category references.`);
  console.log(`Deleted ${deletedCount} duplicate categories.`);
}

const SCRIPT_PATH = resolve(fileURLToPath(import.meta.url));

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  main().catch((error) => {
    console.error("Duplicate category cleanup failed:");
    console.error(error);
    process.exitCode = 1;
  });
}
