import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";
import { buildTransactionPayload } from "../../src/utils/transactionDraftMapper.js";

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "test:integration:fixed-expense-linking" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "test:integration:fixed-expense-linking" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  const suffix = Date.now();
  const accountRef = db.collection("accounts").doc(`emu-acc-${suffix}`);
  const categoryRef = db.collection("categories").doc(`emu-cat-${suffix}`);
  const fixedExpenseRef = db.collection("fixedExpenses").doc(`emu-fx-${suffix}`);
  const transactionRef = db.collection("transactions").doc(`emu-tx-${suffix}`);

  await accountRef.set({
    name: "Compte test integration",
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await categoryRef.set({
    name: "Abonnements",
    type: "depense",
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  await fixedExpenseRef.set({
    name: "Abonnement internet",
    accountId: accountRef.id,
    categoryId: categoryRef.id,
    categoryName: "Abonnements",
    category: "Abonnements",
    initialAmount: 59.9,
    frequency: "monthly",
    startDate: "2026-07-13",
    isActive: true,
    createdAt: FieldValue.serverTimestamp(),
  });

  const payload = buildTransactionPayload({
    date: "2026-07-13",
    montant: "59.9",
    categorie: "Abonnements",
    categoryName: "Abonnements",
    categoryId: categoryRef.id,
    description: "Facture internet",
    type: "depense",
    accountId: accountRef.id,
    isFixedExpense: true,
    fixedExpenseId: fixedExpenseRef.id,
  });

  if (Object.hasOwn(payload, "isFixedExpense") || Object.hasOwn(payload, "fixedExpenseId")) {
    throw new Error("Payload transaction invalide: des champs de liaison frais fixe ont ete ajoutes");
  }

  await transactionRef.set({
    ...payload,
    isDeleted: false,
    createdAt: FieldValue.serverTimestamp(),
  });

  const txSnap = await transactionRef.get();
  const txData = txSnap.data() || {};

  if (Object.hasOwn(txData, "isFixedExpense") || Object.hasOwn(txData, "fixedExpenseId")) {
    throw new Error("Document transaction invalide: des champs de liaison frais fixe ont ete ecrits en base");
  }

  await Promise.all([
    transactionRef.delete(),
    fixedExpenseRef.delete(),
    categoryRef.delete(),
    accountRef.delete(),
  ]);

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    transactionDocId: transactionRef.id,
    fixedExpenseDocId: fixedExpenseRef.id,
  }, null, 2));
}

main().catch((error) => {
  console.error("FIXED_EXPENSE_TRANSACTION_LINKING_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
