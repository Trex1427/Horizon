import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const TEST_MARKER = "UX-EMULATOR-TEST-DATA";

async function createAdminDb() {
  const serviceAccountRaw = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(serviceAccountRaw);

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  return {
    db: getFirestore(app),
    projectId: serviceAccount.project_id,
  };
}

async function main() {
  const { db, projectId } = await createAdminDb();

  const snapshot = await db
    .collection("transactions")
    .where("testMarker", "==", TEST_MARKER)
    .limit(1)
    .get();

  const untouched = snapshot.empty;
  if (!untouched) {
    throw new Error("Remote Firestore contains emulator test marker documents");
  }

  console.log(JSON.stringify({
    result: "success",
    projectId,
    remoteTestMarkerCount: 0,
  }, null, 2));
}

main().catch((error) => {
  console.error("REMOTE_UNTOUCHED_CHECK_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
