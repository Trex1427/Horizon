import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildFixedExpenseDocumentId } from "../../src/utils/fixedExpenseIdentity.js";
import { assertAutomatedWriteAllowed, assertEmulatorWriteMode, resolveRuntimeProjectId } from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

async function main() {
  loadEnvFile(".env.test");
  assertEmulatorWriteMode({ operationName: "fixed-expense-architecture" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "fixed-expense-architecture" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);
  const template = {
    name: "EDF",
    frequency: "monthly",
    initialAmount: 40,
    accountId: "emu-account-main",
    categoryId: "emu-category-housing",
    subcategoryId: "",
    thirdPartyId: "emu-third-party-edf",
    activityId: "",
    projectId: "",
    isActive: true,
  };
  const templateId = buildFixedExpenseDocumentId(template);
  const templateRef = db.collection("fixedExpenses").doc(templateId);

  const createOnce = () => db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(templateRef);
    if (snapshot.exists) return false;
    transaction.set(templateRef, template);
    return true;
  });

  const concurrentResults = await Promise.all(Array.from({ length: 10 }, createOnce));
  const createdCount = concurrentResults.filter(Boolean).length;
  const fixedSnapshot = await db.collection("fixedExpenses").get();
  if (createdCount !== 1 || fixedSnapshot.size !== 1) {
    throw new Error(`Expected one concurrent creation, received created=${createdCount}, documents=${fixedSnapshot.size}`);
  }

  await Promise.all([
    db.collection("transactions").doc("edf-january").set({ date: "2026-01-10", montant: 40, type: "depense", fixedExpenseId: templateId, isFixedExpense: true }),
    db.collection("transactions").doc("edf-february").set({ date: "2026-02-10", montant: 57.25, type: "depense", fixedExpenseId: templateId, isFixedExpense: true }),
  ]);
  const linkedSnapshot = await db.collection("transactions").where("fixedExpenseId", "==", templateId).get();
  if (linkedSnapshot.size !== 2) throw new Error("Both monthly occurrences must reference the single template");

  const differentTemplate = { ...template, accountId: "emu-account-secondary" };
  const differentId = buildFixedExpenseDocumentId(differentTemplate);
  await db.collection("fixedExpenses").doc(differentId).set(differentTemplate);
  const finalFixedSnapshot = await db.collection("fixedExpenses").get();
  if (finalFixedSnapshot.size !== 2) throw new Error("A different business identity must remain creatable");

  console.log(JSON.stringify({ result: "success", mode: "emulator", projectId, createdCount, linkedTransactions: linkedSnapshot.size, distinctTemplates: finalFixedSnapshot.size }, null, 2));
}

main().catch((error) => {
  console.error("FIXED_EXPENSE_ARCHITECTURE_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
