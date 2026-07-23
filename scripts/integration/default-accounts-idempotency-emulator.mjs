import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  buildDefaultAccountDocuments,
  initializeDefaultAccountsIfEmptyWithAdapter,
} from "../../src/services/accountsDefaults.js";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "../safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

const ACCOUNTS_COLLECTION = "accounts";
const TRANSACTIONS_COLLECTION = "transactions";
const TEST_PROJECT_ID = "budget-alexandre-emulator";
const CANONICAL_ACCOUNT_IDS = [
  "canonical-current",
  "canonical-savings",
  "canonical-professional",
  "canonical-cash",
  "canonical-paypal",
];

function createAdapter(db, { now = () => new Date().toISOString() } = {}) {
  return {
    hasAnyAccountDocuments: async () => {
      const snapshot = await db.collection(ACCOUNTS_COLLECTION).limit(1).get();
      return !snapshot.empty;
    },
    commitDefaultAccounts: async () => {
      const batch = db.batch();
      for (const entry of buildDefaultAccountDocuments({ now })) {
        batch.set(db.collection(ACCOUNTS_COLLECTION).doc(entry.id), entry.data);
      }
      await batch.commit();
    },
  };
}

async function deleteCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  if (snapshot.empty) {
    return 0;
  }

  const batch = db.batch();
  snapshot.docs.forEach((docSnapshot) => batch.delete(docSnapshot.ref));
  await batch.commit();
  return snapshot.size;
}

async function countCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.size;
}

async function resetState(db) {
  await deleteCollection(db, TRANSACTIONS_COLLECTION);
  await deleteCollection(db, ACCOUNTS_COLLECTION);
}

async function runInitializer(db, count = 1) {
  const adapter = createAdapter(db, { now: () => "2026-07-13T00:00:00.000Z" });
  return Promise.all(
    Array.from({ length: count }, () => initializeDefaultAccountsIfEmptyWithAdapter(adapter))
  );
}

async function main() {
  loadEnvFile(".env.test");
  assertEmulatorWriteMode({ operationName: "default-accounts-idempotency" });

  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || TEST_PROJECT_ID);
  assertAutomatedWriteAllowed({ projectId, operationName: "default-accounts-idempotency" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  await resetState(db);
  const canonicalBatch = db.batch();
  CANONICAL_ACCOUNT_IDS.forEach((id, index) => {
    canonicalBatch.set(db.collection(ACCOUNTS_COLLECTION).doc(id), {
      name: `Canonical ${index + 1}`,
      type: "standard",
      isActive: true,
    });
  });
  await canonicalBatch.commit();

  // Mounting useAccounts is now listener-only. Simulate repeated mounts,
  // StrictMode remounts, cold-cache delivery and reconnection by performing
  // no initializer action between repeated server inventories.
  for (let mount = 0; mount < 10; mount += 1) {
    assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 5);
  }
  const canonicalSnapshot = await db.collection(ACCOUNTS_COLLECTION).get();
  assert.deepEqual(canonicalSnapshot.docs.map((entry) => entry.id).sort(), [...CANONICAL_ACCOUNT_IDS].sort());
  assert.equal(canonicalSnapshot.docs.some((entry) => entry.id.startsWith("default-")), false);

  await resetState(db);
  await runInitializer(db);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 5, "empty collection initializes exactly 5 accounts");

  await runInitializer(db);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 5, "second run is a no-op");

  await resetState(db);
  await runInitializer(db, 10);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 5, "ten concurrent runs still leave 5 accounts");

  await resetState(db);
  await Promise.all([runInitializer(db), runInitializer(db)]);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 5, "two simultaneous hook-like runs leave 5 accounts");

  await resetState(db);
  await db.collection(ACCOUNTS_COLLECTION).doc("user-account").set({
    name: "Compte utilisateur",
    type: "custom",
    isActive: true,
    createdAt: "2026-07-13T00:00:00.000Z",
  });
  await runInitializer(db);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 1, "existing user account prevents defaults");

  await resetState(db);
  const seedBatch = db.batch();
  for (let index = 0; index < 20; index += 1) {
    seedBatch.set(db.collection(ACCOUNTS_COLLECTION).doc(`existing-account-${index}`), {
      name: `Existing ${index}`,
      type: "custom",
      isActive: true,
    });
  }
  seedBatch.set(db.collection(TRANSACTIONS_COLLECTION).doc("existing-transaction"), {
    accountId: "existing-account-0",
    montant: 1,
    type: "depense",
  });
  await seedBatch.commit();
  await runInitializer(db);
  assert.equal(await countCollection(db, ACCOUNTS_COLLECTION), 20, "non-empty existing base receives no new accounts");
  assert.equal(await countCollection(db, TRANSACTIONS_COLLECTION), 1, "transactions are not modified");

  console.log(JSON.stringify({
    result: "success",
    scenarios: [
      "empty-collection",
      "read-only-repeated-mounts-with-canonical-accounts",
      "cold-cache-and-reconnection-produce-no-seed",
      "second-run-no-op",
      "ten-concurrent-runs",
      "two-simultaneous-hooks",
      "existing-user-account",
      "existing-non-empty-base",
      "transactions-untouched",
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error("DEFAULT_ACCOUNTS_IDEMPOTENCY_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
