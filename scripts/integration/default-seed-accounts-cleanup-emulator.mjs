import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  CANONICAL_ACCOUNTS,
  DEFAULT_SEED_ACCOUNTS,
  EXPECTED_PROJECT_ID,
  runCleanupWithDb,
} from "../maintenance/cleanup-default-seed-accounts.mjs";

const GROUPS = [
  { name: "Compte courant", type: "standard", icon: "💳", color: "#1976d2", displayOrder: 1, canonicalId: CANONICAL_ACCOUNTS["Compte courant"], seedId: "default-current-account" },
  { name: "Livret A", type: "savings", icon: "🏦", color: "#2e7d32", displayOrder: 2, canonicalId: CANONICAL_ACCOUNTS["Livret A"], seedId: "default-savings-a" },
  { name: "Compte professionnel", type: "business", icon: "💼", color: "#7b1fa2", displayOrder: 3, canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"], seedId: "default-professional-account" },
  { name: "Espèces", type: "cash", icon: "💵", color: "#ef6c00", displayOrder: 4, canonicalId: CANONICAL_ACCOUNTS["Espèces"], seedId: "default-cash" },
  { name: "PayPal", type: "digital", icon: "🟣", color: "#6a1b9a", displayOrder: 5, canonicalId: CANONICAL_ACCOUNTS.PayPal, seedId: "default-paypal" },
];

function makeAccount(group, initialBalance = 0) {
  return {
    name: group.name,
    type: group.type,
    icon: group.icon,
    color: group.color,
    initialBalance,
    isActive: true,
    displayOrder: group.displayOrder,
    createdAt: "2026-07-16T21:20:18.782Z",
    updatedAt: "2026-07-16T21:20:18.782Z",
  };
}

async function deleteCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;
  const batch = db.batch();
  for (const document of snapshot.docs) batch.delete(document.ref);
  await batch.commit();
}

async function reset(db, options = {}) {
  for (const collectionName of ["accounts", "transactions", "fixedExpenses", "recurringIncome", "opportunities", "budgets", "objectives", "bankImports"]) {
    await deleteCollection(db, collectionName);
  }

  const accountsBatch = db.batch();
  for (const group of GROUPS) {
    accountsBatch.set(db.collection("accounts").doc(group.canonicalId), makeAccount(group));
    accountsBatch.set(db.collection("accounts").doc(group.seedId), makeAccount(group, group.seedId === options.seedWithInitialBalance ? 1 : 0));
  }
  if (options.ambiguousCanonical) {
    accountsBatch.set(db.collection("accounts").doc("ambiguous-current-account"), makeAccount(GROUPS[0]));
  }
  await accountsBatch.commit();

  const txBatch = db.batch();
  for (let index = 0; index < 10; index += 1) {
    txBatch.set(db.collection("transactions").doc(`tx-${index}`), {
      accountId: index === 0 && options.seedTransactionReference ? options.seedTransactionReference : CANONICAL_ACCOUNTS["Compte courant"],
      type: index % 2 === 0 ? "revenu" : "depense",
      montant: index + 1,
    });
  }
  await txBatch.commit();

  if (options.collectionReference) {
    await db.collection(options.collectionReference.collection).doc("seed-reference").set(options.collectionReference.data);
  }
}

async function count(db, collectionName) {
  return (await db.collection(collectionName).get()).size;
}

async function expectRefused(db, options, expectedGuardText) {
  await reset(db, options);
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "emulator-test" });
  assert.equal(report.writesPerformed, 0);
  assert.equal(await count(db, "accounts"), options.ambiguousCanonical ? 11 : 10);
  assert.ok(report.guards.some((guard) => guard.includes(expectedGuardText)), JSON.stringify(report.guards));
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required.");
  }

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: EXPECTED_PROJECT_ID });
  const db = getFirestore(app);

  await reset(db);
  const dryRun = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: false, source: "emulator-test" });
  assert.equal(dryRun.verdict, "DRY_RUN_OK");
  assert.equal(dryRun.writesPerformed, 0);
  assert.equal(await count(db, "accounts"), 10);
  assert.equal(await count(db, "transactions"), 10);

  const applied = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "emulator-test" });
  assert.equal(applied.writesPerformed, 5);
  assert.deepEqual(applied.deletedIds.sort(), DEFAULT_SEED_ACCOUNTS.map((seed) => seed.id).sort());
  assert.equal(await count(db, "accounts"), 5);
  assert.equal(await count(db, "transactions"), 10);
  assert.deepEqual(applied.after.accountIds.sort(), Object.values(CANONICAL_ACCOUNTS).sort());

  await expectRefused(db, { seedTransactionReference: "default-current-account" }, "transaction reference");
  await expectRefused(db, { collectionReference: { collection: "fixedExpenses", data: { accountId: "default-savings-a" } } }, "non-transaction reference");
  await expectRefused(db, { collectionReference: { collection: "recurringIncome", data: { accountId: "default-professional-account" } } }, "non-transaction reference");
  await expectRefused(db, { collectionReference: { collection: "opportunities", data: { nested: { accountId: "default-cash" } } } }, "non-transaction reference");
  await expectRefused(db, { seedWithInitialBalance: "default-current-account" }, "non-zero initialBalance");
  await expectRefused(db, { ambiguousCanonical: true }, "exactly one non-default canonical");

  await reset(db);
  for (const collectionName of ["accounts", "transactions", "fixedExpenses", "recurringIncome", "opportunities", "budgets", "objectives", "bankImports"]) {
    await deleteCollection(db, collectionName);
  }

  console.log(JSON.stringify({
    scenario: "default-seed-accounts-cleanup-emulator",
    dryRunWrites: dryRun.writesPerformed,
    applyWrites: applied.writesPerformed,
    deletedIds: applied.deletedIds,
    verdict: "EMULATOR CLEANUP SCENARIO PASSED",
  }, null, 2));
}

main().catch((error) => {
  console.error("default seed account cleanup emulator scenario failed");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
