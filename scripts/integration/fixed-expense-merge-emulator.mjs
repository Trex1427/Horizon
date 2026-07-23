import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS,
  AUTHORIZED_FIXED_EXPENSE_DELETE_IDS,
  runFixedExpenseDuplicateMergeWithDb,
} from "../maintenance/merge-duplicate-fixed-expenses.mjs";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

function fixedExpense(id, overrides = {}) {
  return {
    name: "Telephone",
    accountId: "account-current",
    categoryId: "category-subscriptions",
    subcategoryId: "",
    thirdPartyId: "",
    projectId: "",
    activityId: "",
    frequency: "monthly",
    initialAmount: 15.99,
    startDate: "2026-07-09",
    endDate: null,
    variations: [],
    isActive: true,
    createdAt: overrides.createdAt || "2026-01-01T00:00:00.000Z",
    ...overrides,
    id,
  };
}

function buildSeedState() {
  const [taxCanonical, phoneCanonical] = AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS;
  const [taxDuplicate, ...phoneDuplicates] = AUTHORIZED_FIXED_EXPENSE_DELETE_IDS;
  return {
    accounts: [{ id: "account-current", name: "Compte courant" }],
    categories: [
      { id: "category-subscriptions", name: "Abonnements", type: "depense" },
      { id: "category-tax", name: "Impots", type: "depense" },
      { id: "category-leisure", name: "Loisirs", type: "depense" },
      { id: "category-housing", name: "Logement", type: "depense" },
      { id: "category-health", name: "Sante", type: "depense" },
      { id: "category-transport", name: "Transport", type: "depense" },
    ],
    fixedExpenses: [
      fixedExpense("KTeNytiDvtOM8z7RuaZT", { name: "Assurance voiture", categoryId: "category-transport", initialAmount: 110.01, startDate: "2026-07-10" }),
      fixedExpense("rD0OvN9mr7JS71a4Y9Qp", { name: "Chat GPT", initialAmount: 23, startDate: "2026-06-16" }),
      fixedExpense("bAnx9hMT9EB1yU70puRg", { name: "Eau", categoryId: "category-housing", initialAmount: 10.09, startDate: "2026-07-10" }),
      fixedExpense("dVxNSsip1NwzmJc9I7TN", { name: "Electricite", categoryId: "category-housing", initialAmount: 40, startDate: "2026-06-11" }),
      fixedExpense("XnhZmesyyuV3FhQrzhrz", { name: "Google", initialAmount: 1, startDate: "2026-06-29" }),
      fixedExpense(taxDuplicate, { name: "Impots Prlv a la source", categoryId: "category-tax", initialAmount: 29, startDate: "2026-06-15", isActive: true, createdAt: "2026-01-02T00:00:00.000Z" }),
      fixedExpense(taxCanonical, { name: "Impots Prlv a la source", categoryId: "category-tax", initialAmount: 29, startDate: "2026-06-15", isActive: false, createdAt: "2026-01-01T00:00:00.000Z" }),
      fixedExpense("Xed6IZ9z5ZFk1WF8Acmy", { name: "Keepcool", categoryId: "category-leisure", initialAmount: 29.99, startDate: "2026-06-02" }),
      fixedExpense("2zovmFQPP3Bj1b8aaMCZ", { name: "Loyer", categoryId: "category-housing", initialAmount: 658.44, startDate: "2026-07-06" }),
      fixedExpense("s6dagMLxjgjvORQ2EKPG", { name: "Mutuelle MSA", categoryId: "category-health", initialAmount: 14, startDate: "2026-06-15" }),
      fixedExpense("sJBesKzDWfGl8nx0UJ6k", { name: "Podcats papacito", categoryId: "category-leisure", initialAmount: 6, startDate: "2026-06-25" }),
      fixedExpense(phoneDuplicates[0], { isActive: false, createdAt: "2026-01-02T00:00:00.000Z" }),
      fixedExpense(phoneDuplicates[1], { isActive: false, createdAt: "2026-01-03T00:00:00.000Z" }),
      fixedExpense(phoneCanonical, { isActive: true, createdAt: "2026-01-01T00:00:00.000Z" }),
      fixedExpense(phoneDuplicates[2], { isActive: false, createdAt: "2026-01-04T00:00:00.000Z" }),
    ],
    transactions: Array.from({ length: 208 }, (_, index) => ({
      id: `tx-${String(index + 1).padStart(3, "0")}`,
      date: "2026-07-05",
      type: "depense",
      montant: 1,
      accountId: "account-current",
      isDeleted: false,
    })),
  };
}

async function seedCollection(db, collectionName, documents) {
  const batch = db.batch();
  for (const document of documents) {
    const { id, ...data } = document;
    batch.set(db.collection(collectionName).doc(id), data);
  }
  await batch.commit();
}

async function collectionIds(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((doc) => doc.id).sort();
}

async function main() {
  loadEnvFile(".env.test");
  assertEmulatorWriteMode({ operationName: "fixed-expense-merge-emulator" });
  assertAutomatedWriteAllowed({ projectId: "budget-alexandre", operationName: "fixed-expense-merge-emulator" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: "budget-alexandre" });
  const db = getFirestore(app);
  const state = buildSeedState();

  await seedCollection(db, "accounts", state.accounts);
  await seedCollection(db, "categories", state.categories);
  await seedCollection(db, "fixedExpenses", state.fixedExpenses);
  await seedCollection(db, "transactions", state.transactions);

  const beforeTransactionIds = await collectionIds(db, "transactions");
  const report = await runFixedExpenseDuplicateMergeWithDb({
    db,
    projectId: "budget-alexandre",
    apply: true,
    source: "emulator:fixed-expense-merge",
    year: 2026,
  });
  const afterFixedExpenseIds = await collectionIds(db, "fixedExpenses");
  const afterTransactionIds = await collectionIds(db, "transactions");

  if (report.verdict !== "MERGE_APPLIED_OK") throw new Error(`Verdict inattendu: ${report.verdict}`);
  if (report.during.writesPerformed !== 4) throw new Error(`Writes attendues 4, recues ${report.during.writesPerformed}`);
  if (afterFixedExpenseIds.length !== 11) throw new Error(`fixedExpenses attendu 11, recu ${afterFixedExpenseIds.length}`);
  if (afterTransactionIds.length !== 208) throw new Error(`transactions attendu 208, recu ${afterTransactionIds.length}`);
  if (JSON.stringify(beforeTransactionIds) !== JSON.stringify(afterTransactionIds)) throw new Error("Transactions modifiees dans le scenario emulateur.");
  for (const id of AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS) {
    if (!afterFixedExpenseIds.includes(id)) throw new Error(`Canonique absent: ${id}`);
  }
  for (const id of AUTHORIZED_FIXED_EXPENSE_DELETE_IDS) {
    if (afterFixedExpenseIds.includes(id)) throw new Error(`Doublon encore present: ${id}`);
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId: "budget-alexandre",
    writesPerformed: report.during.writesPerformed,
    deletedFixedExpenseIds: report.during.deletedFixedExpenseIds,
    remainingFixedExpenses: afterFixedExpenseIds.length,
    transactions: afterTransactionIds.length,
    forecastJulyToDecember: report.after.forecast
      .filter((month) => month.month >= "2026-07" && month.month <= "2026-12")
      .map((month) => ({ month: month.month, expectedFixedExpenses: Math.round(month.expectedFixedExpenses * 100) / 100 })),
  }, null, 2));
}

main().catch((error) => {
  console.error("FIXED_EXPENSE_MERGE_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
