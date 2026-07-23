import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed } from "./safety/automatedWriteGuard.mjs";
import { SEED_SOURCE } from "./reference-seed-lib.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const GITIGNORE_PATH = resolve(process.cwd(), ".gitignore");
const TARGET_COLLECTIONS = ["activities", "thirdParties", "projects", "subcategories"];

function loadServiceAccount(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Impossible de charger le fichier de credentials Firebase Admin.");
    console.error(`Chemin attendu: ${path}`);
    throw error;
  }
}

function verifyGitIgnoreRules() {
  try {
    const content = readFileSync(GITIGNORE_PATH, "utf8");
    const requiredRules = ["scripts/maintenance/service-account.json", "**/service-account.json"];
    const missingRules = requiredRules.filter((rule) => !content.includes(rule));

    if (missingRules.length > 0) {
      console.warn("WARNING: .gitignore ne contient pas toutes les regles attendues pour les credentials.");
      for (const rule of missingRules) {
        console.warn(`- Regle manquante: ${rule}`);
      }
    }
  } catch {
    console.warn("WARNING: impossible de verifier .gitignore.");
  }
}

async function deleteSeededDocsInCollection(db, collectionName) {
  let deletedCount = 0;
  let errors = 0;

  try {
    const snapshot = await db.collection(collectionName).where("seedSource", "==", SEED_SOURCE).get();
    const refs = snapshot.docs.map((docSnapshot) => docSnapshot.ref);

    let batch = db.batch();
    let batchSize = 0;

    const commitBatch = async () => {
      if (batchSize === 0) {
        return;
      }

      await batch.commit();
      batch = db.batch();
      batchSize = 0;
    };

    for (const ref of refs) {
      batch.delete(ref);
      batchSize += 1;
      deletedCount += 1;

      if (batchSize === 450) {
        await commitBatch();
      }
    }

    await commitBatch();
  } catch (error) {
    errors += 1;
    console.error(`Erreur cleanup collection ${collectionName}: ${error?.message || "inconnue"}`);
  }

  return { deletedCount, errors };
}

async function main() {
  verifyGitIgnoreRules();

  const serviceAccount = loadServiceAccount(SERVICE_ACCOUNT_PATH);
  assertAutomatedWriteAllowed({
    projectId: serviceAccount.project_id,
    operationName: "cleanup:references",
  });

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  const db = getFirestore(app);
  const summary = {};

  for (const collectionName of TARGET_COLLECTIONS) {
    summary[collectionName] = await deleteSeededDocsInCollection(db, collectionName);
  }

  console.log("Cleanup references termine.");
  for (const collectionName of TARGET_COLLECTIONS) {
    console.log(`- ${collectionName} : supprimes=${summary[collectionName].deletedCount}, erreurs=${summary[collectionName].errors}`);
  }
}

main().catch((error) => {
  console.error("Cleanup references echoue.");
  console.error(error?.message || error);
  process.exitCode = 1;
});
