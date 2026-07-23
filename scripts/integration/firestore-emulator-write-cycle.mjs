import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

const TEST_MARKER = "UX-EMULATOR-TEST-DATA";

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "test:integration" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "test:integration" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  const transactionId = `emu-int-${Date.now()}`;
  const ref = db.collection("transactions").doc(transactionId);

  await ref.set({
    date: "2026-07-13",
    montant: 42.13,
    type: "depense",
    description: "Integration create/delete cycle",
    categoryId: "emu-cat-transport",
    categoryName: "Transport",
    accountId: "emu-account-main",
    isDeleted: false,
    testMarker: TEST_MARKER,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const createdSnap = await ref.get();
  if (!createdSnap.exists) {
    throw new Error("Transaction creation failed in emulator integration test");
  }

  await ref.delete();

  const deletedSnap = await ref.get();
  if (deletedSnap.exists) {
    throw new Error("Transaction deletion failed in emulator integration test");
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    createdThenDeletedTransactionId: transactionId,
  }, null, 2));
}

main().catch((error) => {
  console.error("INTEGRATION_WRITE_CYCLE_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
