import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "./safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "./safety/loadEnvFile.mjs";

const TEST_MARKER = "UX-EMULATOR-TEST-DATA";
const COLLECTIONS = [
  "transactions",
  "projects",
  "activities",
  "thirdParties",
  "subcategories",
  "categories",
  "accounts",
];

async function deleteByMarker(db, collectionName) {
  const snapshot = await db.collection(collectionName).where("testMarker", "==", TEST_MARKER).get();
  if (snapshot.empty) {
    return 0;
  }

  let batch = db.batch();
  let batchSize = 0;
  let deletedCount = 0;

  const commitBatch = async () => {
    if (batchSize === 0) {
      return;
    }

    await batch.commit();
    batch = db.batch();
    batchSize = 0;
  };

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    batchSize += 1;
    deletedCount += 1;

    if (batchSize === 400) {
      await commitBatch();
    }
  }

  await commitBatch();
  return deletedCount;
}

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "cleanup:test" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "cleanup:test" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  const deleted = {};
  for (const collectionName of COLLECTIONS) {
    deleted[collectionName] = await deleteByMarker(db, collectionName);
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    testMarker: TEST_MARKER,
    deleted,
  }, null, 2));
}

main().catch((error) => {
  console.error("CLEANUP_TEST_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
