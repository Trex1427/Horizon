import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const SOURCE_OWNER_UID = "s0841QJdHWXZV7fSaIlVvR6SFZq1";
export const TARGET_OWNER_UID = "wS0YVERetOhpl2UcVCeQ9WtIO9x1";
export const DEFAULT_BATCH_SIZE = 400;

function parseOptions(args) {
  const options = {
    apply: false,
    projectId: process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT,
    databaseId: "(default)",
    batchSize: DEFAULT_BATCH_SIZE,
  };

  for (const arg of args) {
    if (arg === "--apply") options.apply = true;
    else if (arg.startsWith("--project-id=")) options.projectId = arg.slice("--project-id=".length);
    else if (arg.startsWith("--database-id=")) options.databaseId = arg.slice("--database-id=".length);
    else if (arg.startsWith("--batch-size=")) options.batchSize = Number(arg.slice("--batch-size=".length));
    else throw new Error(`Argument inconnu : ${arg}`);
  }

  if (!options.projectId) throw new Error("--project-id est requis.");
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 500) {
    throw new Error("--batch-size doit être un entier compris entre 1 et 500.");
  }
  return options;
}

async function createFirestore(projectId, databaseId) {
  if (!getApps().length) {
    const serviceAccountPath = resolve(process.cwd(), "scripts/maintenance/service-account.json");
    let credential;
    try {
      credential = cert(JSON.parse(await readFile(serviceAccountPath, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    initializeApp({ projectId, ...(credential ? { credential } : {}) });
  }
  return getFirestore(getApps()[0], databaseId);
}

function errorDetails(error, context) {
  return {
    context,
    code: error?.code || null,
    message: error?.message || String(error),
  };
}

export async function scanRootCollections(db) {
  const report = {
    documentsScanned: 0,
    documentsToMigrate: 0,
    alreadyMigrated: 0,
    byCollection: {},
    candidates: [],
    errors: [],
  };

  let collections;
  try {
    collections = await db.listCollections();
  } catch (error) {
    report.errors.push(errorDetails(error, "listCollections"));
    return report;
  }

  for (const collection of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    const counts = { scanned: 0, toMigrate: 0, alreadyMigrated: 0 };
    report.byCollection[collection.id] = counts;
    try {
      const snapshot = await collection.get();
      for (const document of snapshot.docs) {
        report.documentsScanned += 1;
        counts.scanned += 1;
        const ownerUid = document.get("ownerUid");
        if (ownerUid === TARGET_OWNER_UID) {
          report.alreadyMigrated += 1;
          counts.alreadyMigrated += 1;
        }
        if (ownerUid !== SOURCE_OWNER_UID) continue;

        report.documentsToMigrate += 1;
        counts.toMigrate += 1;
        report.candidates.push({
          collection: collection.id,
          documentId: document.id,
          path: document.ref.path,
          currentOwnerUid: ownerUid,
          targetOwnerUid: TARGET_OWNER_UID,
          ref: document.ref,
          updateTime: document.updateTime,
        });
      }
    } catch (error) {
      report.errors.push(errorDetails(error, `scan:${collection.id}`));
    }
  }
  return report;
}

export async function applyCandidates(db, candidates, batchSize = DEFAULT_BATCH_SIZE) {
  let modified = 0;
  const errors = [];

  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const group = candidates.slice(offset, offset + batchSize);
    const batch = db.batch();
    for (const candidate of group) {
      batch.update(candidate.ref, { ownerUid: TARGET_OWNER_UID }, { lastUpdateTime: candidate.updateTime });
    }
    try {
      await batch.commit();
      modified += group.length;
    } catch (error) {
      errors.push(errorDetails(error, `batch:${offset / batchSize + 1} (${group[0].path} … ${group.at(-1).path})`));
    }
  }
  return { modified, errors };
}

function printReport(report, mode, modified, errors) {
  console.log(`\nMode : ${mode}`);
  console.log(`UID source : ${SOURCE_OWNER_UID}`);
  console.log(`UID cible : ${TARGET_OWNER_UID}`);
  console.log("\nDocuments à migrer :");
  if (!report.candidates.length) console.log("  Aucun");
  for (const item of report.candidates) {
    console.log(`  ${item.collection} | ${item.documentId} | ${item.currentOwnerUid} -> ${item.targetOwnerUid}`);
  }

  console.log("\nRépartition par collection :");
  for (const [collection, counts] of Object.entries(report.byCollection)) {
    console.log(`  ${collection}: scannés=${counts.scanned}, à migrer=${counts.toMigrate}, déjà migrés=${counts.alreadyMigrated}`);
  }

  console.log("\nRésumé :");
  console.log(`  Nombre de documents scannés : ${report.documentsScanned}`);
  console.log(`  Nombre de documents à migrer : ${report.documentsToMigrate}`);
  console.log(`  Nombre réellement modifié : ${modified}`);
  console.log(`  Erreurs : ${errors.length}`);
  for (const error of errors) console.error(`  [${error.context}] ${error.code ? `${error.code}: ` : ""}${error.message}`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const db = await createFirestore(options.projectId, options.databaseId);
  const report = await scanRootCollections(db);
  let result = { modified: 0, errors: [] };

  if (options.apply && report.errors.length === 0) {
    result = await applyCandidates(db, report.candidates, options.batchSize);
  }
  const errors = [...report.errors, ...result.errors];
  printReport(report, options.apply ? "APPLY" : "SIMULATION (lecture seule)", result.modified, errors);

  if (options.apply && report.errors.length) {
    console.error("\nMigration annulée : le scan contient des erreurs, aucune écriture n’a été tentée.");
  }
  if (errors.length) process.exitCode = 1;
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname.replace(/^\/(.:)/, "$1"));
if (isDirectRun) main().catch((error) => {
  console.error(`Erreur fatale : ${error?.stack || error}`);
  process.exitCode = 1;
});

