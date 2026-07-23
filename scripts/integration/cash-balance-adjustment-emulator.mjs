import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

const TEST_MARKER = "CASH-ADJUSTMENT-EMULATOR-TEST";

function calculateCashBalance(account, transactions = []) {
  return transactions
    .filter((transaction) => transaction.accountId === account.id && transaction.isDeleted !== true)
    .reduce((sum, transaction) => {
      if (transaction.type === "adjustment") {
        return sum + Number(transaction.montant || 0);
      }

      if (transaction.type === "revenu") {
        return sum + Number(transaction.montant || 0);
      }

      if (transaction.type === "depense") {
        return sum - Number(transaction.montant || 0);
      }

      return sum;
    }, Number(account.initialBalance || 0));
}

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "cash-balance-adjustment-emulator" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "cash-balance-adjustment-emulator" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  const runId = `cash-adj-${Date.now()}`;
  const account = {
    id: `${runId}-account`,
    name: "Espèces",
    type: "cash",
    initialBalance: 72.35,
    isActive: true,
    testMarker: TEST_MARKER,
  };
  const adjustmentId = `${runId}-adjustment`;
  const adjustment = {
    accountId: account.id,
    type: "adjustment",
    montant: 15,
    amount: 15,
    date: "2026-07-14",
    description: "Ajustement de solde Espèces",
    adjustmentKind: "balance",
    targetBalance: 87.35,
    theoreticalBalance: 72.35,
    adjustmentReason: "Comptage emulator",
    isDeleted: false,
    testMarker: TEST_MARKER,
  };

  await db.collection("accounts").doc(account.id).set(account);
  await db.collection("transactions").doc(adjustmentId).set(adjustment);
  await db.collection("transactions").doc(adjustmentId).set(adjustment);

  const snap = await db.collection("transactions")
    .where("testMarker", "==", TEST_MARKER)
    .where("accountId", "==", account.id)
    .get();

  if (snap.size !== 1) {
    throw new Error(`Expected exactly one adjustment after duplicate submit, got ${snap.size}`);
  }

  const persisted = snap.docs[0].data();
  if (persisted.type !== "adjustment" || persisted.targetBalance !== 87.35 || persisted.montant !== 15) {
    throw new Error("Adjustment persisted fields are invalid");
  }

  const balanceAfterCreate = calculateCashBalance(account, [persisted]);
  if (balanceAfterCreate !== 87.35) {
    throw new Error(`Expected adjusted balance 87.35, got ${balanceAfterCreate}`);
  }

  await db.collection("transactions").doc(adjustmentId).update({ isDeleted: true });
  const deletedSnap = await db.collection("transactions").doc(adjustmentId).get();
  const balanceAfterDelete = calculateCashBalance(account, [deletedSnap.data()]);

  if (balanceAfterDelete !== 72.35) {
    throw new Error(`Expected balance 72.35 after soft delete, got ${balanceAfterDelete}`);
  }

  await db.collection("transactions").doc(adjustmentId).delete();
  await db.collection("accounts").doc(account.id).delete();

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    adjustmentId,
    balanceAfterCreate,
    balanceAfterDelete,
  }, null, 2));
}

main().catch((error) => {
  console.error("CASH_BALANCE_ADJUSTMENT_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
