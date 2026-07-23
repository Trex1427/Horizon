import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  CANONICAL_ACCOUNTS,
  CLEANUP_CANDIDATES,
  CURRENT_ACCOUNT_ID,
  EXPECTED_PROJECT_ID,
  runCleanupWithDb,
} from "../maintenance/cleanup-duplicate-accounts.mjs";

const GROUP_DEFINITIONS = [
  { name: "Compte courant", type: "standard", icon: "card", color: "#1976d2", displayOrder: 1, canonicalId: CANONICAL_ACCOUNTS["Compte courant"] },
  { name: "Compte professionnel", type: "business", icon: "briefcase", color: "#7b1fa2", displayOrder: 3, canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"] },
  { name: "Espèces", type: "cash", icon: "cash", color: "#ef6c00", displayOrder: 4, canonicalId: CANONICAL_ACCOUNTS["Espèces"] },
  { name: "Livret A", type: "savings", icon: "bank", color: "#2e7d32", displayOrder: 2, canonicalId: CANONICAL_ACCOUNTS["Livret A"] },
  { name: "PayPal", type: "digital", icon: "paypal", color: "#6a1b9a", displayOrder: 5, canonicalId: CANONICAL_ACCOUNTS.PayPal },
];

function makeAccount(group, id, index) {
  return {
    name: group.name,
    type: group.type,
    icon: group.icon,
    color: group.color,
    initialBalance: 0,
    isActive: true,
    displayOrder: group.displayOrder,
    createdAt: `2026-07-13T13:20:34.${String(index).padStart(3, "0")}Z`,
  };
}

async function deleteCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) return;
  let batch = db.batch();
  let size = 0;
  for (const document of snapshot.docs) {
    batch.delete(document.ref);
    size += 1;
    if (size === 450) {
      await batch.commit();
      batch = db.batch();
      size = 0;
    }
  }
  if (size > 0) await batch.commit();
}

async function resetFixtures(db, { referencedCandidate = null } = {}) {
  await deleteCollection(db, "transactions");
  await deleteCollection(db, "accounts");

  let index = 1;
  const accountsBatch = db.batch();
  for (const group of GROUP_DEFINITIONS) {
    accountsBatch.set(db.collection("accounts").doc(group.canonicalId), makeAccount(group, group.canonicalId, index));
    index += 1;
    const candidates = CLEANUP_CANDIDATES.filter((candidate) => candidate.group === group.name);
    for (const candidate of candidates) {
      accountsBatch.set(db.collection("accounts").doc(candidate.id), makeAccount(group, candidate.id, index));
      index += 1;
    }
  }
  await accountsBatch.commit();

  const transactionsBatch = db.batch();
  for (let txIndex = 0; txIndex < 96; txIndex += 1) {
    transactionsBatch.set(db.collection("transactions").doc(`tx-${txIndex}`), {
      accountId: txIndex === 0 && referencedCandidate ? referencedCandidate : CURRENT_ACCOUNT_ID,
      amount: txIndex + 1,
    });
  }
  await transactionsBatch.commit();
}

async function countCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.size;
}

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required for this integration scenario.");
  }

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId: EXPECTED_PROJECT_ID });
  const db = getFirestore(app);

  await resetFixtures(db);
  const dryRun = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: false, source: "emulator-test" });
  assert.equal(dryRun.writesPerformed, 0);
  assert.equal(await countCollection(db, "accounts"), 20);
  assert.equal(await countCollection(db, "transactions"), 96);

  const applied = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "emulator-test" });
  assert.equal(applied.writesPerformed, 15);
  assert.equal(applied.deletedIds.length, 15);
  assert.equal(await countCollection(db, "accounts"), 5);
  assert.equal(await countCollection(db, "transactions"), 96);

  const remainingAccounts = await db.collection("accounts").get();
  assert.deepEqual(remainingAccounts.docs.map((document) => document.id).sort(), Object.values(CANONICAL_ACCOUNTS).sort());

  await resetFixtures(db, { referencedCandidate: CLEANUP_CANDIDATES[0].id });
  const refused = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "emulator-test" });
  assert.equal(refused.writesPerformed, 0);
  assert.equal(refused.verdict, "NETTOYAGE ANNULE - GARDE-FOU DECLENCHE");
  assert.equal(await countCollection(db, "accounts"), 20);
  assert.equal(await countCollection(db, "transactions"), 96);

  await deleteCollection(db, "transactions");
  await deleteCollection(db, "accounts");

  console.log(JSON.stringify({
    scenario: "duplicate-accounts-cleanup-emulator",
    dryRunWrites: dryRun.writesPerformed,
    applyWrites: applied.writesPerformed,
    refusedWrites: refused.writesPerformed,
    verdict: "EMULATOR CLEANUP SCENARIO PASSED",
  }, null, 2));
}

main().catch((error) => {
  console.error("duplicate account cleanup emulator scenario failed");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
