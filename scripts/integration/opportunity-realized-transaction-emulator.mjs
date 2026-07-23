import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

const TEST_MARKER = "OPPORTUNITY-REALIZED-TRANSACTION-EMULATOR";

async function createLinkedTransaction(db, opportunityId, payload) {
  return db.runTransaction(async (transaction) => {
    const opportunityRef = db.collection("opportunities").doc(opportunityId);
    const opportunitySnap = await transaction.get(opportunityRef);
    if (!opportunitySnap.exists) {
      throw new Error("Opportunity not found");
    }

    const opportunity = opportunitySnap.data();
    if (opportunity.realizedTransactionId) {
      const existingRef = db.collection("transactions").doc(opportunity.realizedTransactionId);
      const existingSnap = await transaction.get(existingRef);
      if (existingSnap.exists && existingSnap.data()?.isDeleted !== true) {
        return {
          status: "already_exists",
          transactionId: opportunity.realizedTransactionId,
        };
      }
    }

    const transactionRef = db.collection("transactions").doc();
    transaction.set(transactionRef, {
      ...payload,
      opportunityId,
      testMarker: TEST_MARKER,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(opportunityRef, {
      realizedTransactionId: transactionRef.id,
      realizedTransactionLinkedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      status: "created",
      transactionId: transactionRef.id,
    };
  });
}

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "opportunity-realized-transaction-emulator" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "opportunity-realized-transaction-emulator" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);
  const runId = `opp-realized-${Date.now()}`;
  const opportunityId = `${runId}-opportunity`;
  const opportunityRef = db.collection("opportunities").doc(opportunityId);

  await opportunityRef.set({
    name: "Prime emulator",
    status: "Realise",
    estimatedAmount: 1180,
    realizedAmount: 1180,
    estimatedDate: "2026-08-20",
    realizedDate: "2026-08-18",
    accountId: "acc-emulator",
    categoryId: "cat-income",
    categoryName: "Prestations",
    isActive: true,
    isDeleted: false,
    testMarker: TEST_MARKER,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const afterCancelSnap = await db.collection("transactions")
    .where("testMarker", "==", TEST_MARKER)
    .where("opportunityId", "==", opportunityId)
    .get();

  if (!afterCancelSnap.empty) {
    throw new Error("Cancel scenario must not create a transaction");
  }

  const payload = {
    date: "2026-08-18",
    montant: 1180,
    type: "revenu",
    description: "Prime emulator",
    accountId: "acc-emulator",
    categoryId: "cat-income",
    categoryName: "Prestations",
    isDeleted: false,
  };

  const firstResult = await createLinkedTransaction(db, opportunityId, payload);
  if (firstResult.status !== "created") {
    throw new Error(`Expected first creation, got ${firstResult.status}`);
  }

  const concurrentResults = await Promise.all(Array.from({ length: 10 }, () => (
    createLinkedTransaction(db, opportunityId, payload)
  )));

  const linkedSnap = await db.collection("transactions")
    .where("testMarker", "==", TEST_MARKER)
    .where("opportunityId", "==", opportunityId)
    .get();
  const reloadedOpportunity = await opportunityRef.get();

  if (linkedSnap.size !== 1) {
    throw new Error(`Expected exactly one linked transaction, got ${linkedSnap.size}`);
  }

  if (reloadedOpportunity.data()?.realizedTransactionId !== firstResult.transactionId) {
    throw new Error("Opportunity back link is invalid");
  }

  if (concurrentResults.some((result) => result.status !== "already_exists")) {
    throw new Error("Concurrent calls must all detect the existing linked transaction");
  }

  await Promise.all(linkedSnap.docs.map((docSnap) => docSnap.ref.delete()));
  await opportunityRef.delete();

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    opportunityId,
    transactionId: firstResult.transactionId,
    concurrentAttempts: concurrentResults.length,
  }, null, 2));
}

main().catch((error) => {
  console.error("OPPORTUNITY_REALIZED_TRANSACTION_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
