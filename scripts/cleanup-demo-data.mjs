import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed } from "./safety/automatedWriteGuard.mjs";
import { DEMO_SEED_SOURCE, countNonSeededTransactions } from "./reference-seed-lib.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const GITIGNORE_PATH = resolve(process.cwd(), ".gitignore");
const REQUIRED_CONFIRMATION_FLAG = "--confirm-run";

function verifyExplicitConfirmation(argv = []) {
  console.warn("WARNING: cleanup:demo supprime uniquement les transactions de demonstration.");
  console.warn("WARNING: execution bloquee sans confirmation explicite.");

  if (!argv.includes(REQUIRED_CONFIRMATION_FLAG)) {
    console.warn(`Relancez avec: npm run cleanup:demo -- ${REQUIRED_CONFIRMATION_FLAG}`);
    process.exitCode = 1;
    return false;
  }

  return true;
}

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

async function loadTransactions(db) {
  const snapshot = await db.collection("transactions").get();
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
}

async function deleteDemoTransactions(db, transactions) {
  const demoTransactions = transactions.filter((transaction) => transaction.seedSource === DEMO_SEED_SOURCE);
  let deletedCount = 0;
  let errors = 0;

  try {
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

    for (const transaction of demoTransactions) {
      batch.delete(db.collection("transactions").doc(transaction.id));
      batchSize += 1;
      deletedCount += 1;

      if (batchSize === 450) {
        await commitBatch();
      }
    }

    await commitBatch();
  } catch (error) {
    errors += 1;
    console.error(`Erreur cleanup demo transactions: ${error?.message || "inconnue"}`);
  }

  return {
    deletedCount,
    ignoredRealCount: countNonSeededTransactions(transactions, DEMO_SEED_SOURCE),
    errors,
  };
}

async function main() {
  if (!verifyExplicitConfirmation(process.argv.slice(2))) {
    return;
  }

  verifyGitIgnoreRules();

  const serviceAccount = loadServiceAccount(SERVICE_ACCOUNT_PATH);
  assertAutomatedWriteAllowed({
    projectId: serviceAccount.project_id,
    operationName: "cleanup:demo",
  });

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  const db = getFirestore(app);
  const transactions = await loadTransactions(db);
  const summary = await deleteDemoTransactions(db, transactions);

  console.log("Cleanup demo termine.");
  console.log(`- transactions demo supprimees : ${summary.deletedCount}`);
  console.log(`- transactions reelles ignorees : ${summary.ignoredRealCount}`);
  console.log(`- erreurs : ${summary.errors}`);
}

main().catch((error) => {
  console.error("Cleanup demo echoue.");
  console.error(error?.message || error);
  process.exitCode = 1;
});
