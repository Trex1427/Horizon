import test from "node:test";
import assert from "node:assert/strict";
import {
  APPLY_FLAG,
  CANONICAL_ACCOUNTS,
  DEFAULT_SEED_ACCOUNTS,
  EXPECTED_PROJECT_ID,
  runCleanupWithDb,
} from "./cleanup-default-seed-accounts.mjs";

const GROUPS = [
  { name: "Compte courant", type: "standard", icon: "card", color: "#1976d2", displayOrder: 1, canonicalId: CANONICAL_ACCOUNTS["Compte courant"], seedId: "default-current-account" },
  { name: "Livret A", type: "savings", icon: "bank", color: "#2e7d32", displayOrder: 2, canonicalId: CANONICAL_ACCOUNTS["Livret A"], seedId: "default-savings-a" },
  { name: "Compte professionnel", type: "business", icon: "briefcase", color: "#7b1fa2", displayOrder: 3, canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"], seedId: "default-professional-account" },
  { name: "Espèces", type: "cash", icon: "cash", color: "#ef6c00", displayOrder: 4, canonicalId: CANONICAL_ACCOUNTS["Espèces"], seedId: "default-cash" },
  { name: "PayPal", type: "digital", icon: "paypal", color: "#6a1b9a", displayOrder: 5, canonicalId: CANONICAL_ACCOUNTS.PayPal, seedId: "default-paypal" },
];

function makeAccount(group) {
  return {
    name: group.name,
    type: group.type,
    icon: group.icon,
    color: group.color,
    initialBalance: 0,
    displayOrder: group.displayOrder,
    isActive: true,
  };
}

class FakeDocRef {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
    this.path = `${collectionName}/${id}`;
  }
  async listCollections() {
    return [];
  }
}

class FakeDb {
  constructor() {
    this.store = new Map();
  }
  collection(name) {
    const thisDb = this;
    return {
      path: name,
      async get() {
        const docs = [...(thisDb.store.get(name) || new Map()).entries()].map(([id, data]) => ({
          id,
          ref: new FakeDocRef(thisDb, name, id),
          data: () => ({ ...data }),
        }));
        return { docs, size: docs.length };
      },
      doc: (id) => new FakeDocRef(this, name, id),
    };
  }
  async listCollections() {
    return [...this.store.keys()].map((name) => this.collection(name));
  }
  batch() {
    const deletes = [];
    return {
      delete: (ref) => deletes.push(ref),
      commit: async () => {
        for (const ref of deletes) {
          this.store.get(ref.collectionName)?.delete(ref.id);
        }
      },
    };
  }
  set(collectionName, id, data) {
    if (!this.store.has(collectionName)) this.store.set(collectionName, new Map());
    this.store.get(collectionName).set(id, { ...data });
  }
  count(collectionName) {
    return this.store.get(collectionName)?.size || 0;
  }
}

function makeDb({ seedReference = null, fixedExpenseReference = null, recurringReference = null, opportunityReference = null, seedInitialBalance = 0, ambiguousCanonical = false } = {}) {
  const db = new FakeDb();
  for (const group of GROUPS) {
    db.set("accounts", group.canonicalId, makeAccount(group));
    db.set("accounts", group.seedId, { ...makeAccount(group), initialBalance: group.seedId === DEFAULT_SEED_ACCOUNTS[0].id ? seedInitialBalance : 0 });
  }
  if (ambiguousCanonical) db.set("accounts", "ambiguous-current", makeAccount(GROUPS[0]));
  for (let index = 0; index < 10; index += 1) {
    db.set("transactions", `tx-${index}`, {
      accountId: index === 0 && seedReference ? seedReference : CANONICAL_ACCOUNTS["Compte courant"],
      type: "depense",
      montant: index + 1,
    });
  }
  if (fixedExpenseReference) db.set("fixedExpenses", "fixed-seed", { accountId: fixedExpenseReference });
  if (recurringReference) db.set("recurringIncome", "recurring-seed", { accountId: recurringReference });
  if (opportunityReference) db.set("opportunities", "opportunity-seed", { nested: { accountId: opportunityReference } });
  return db;
}

test("dry-run performs zero writes and approves the nominal five-seed cleanup", async () => {
  const db = makeDb();
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: false, source: "unit" });

  assert.equal(report.verdict, "DRY_RUN_OK");
  assert.equal(report.writesPerformed, 0);
  assert.equal(db.count("accounts"), 10);
  assert.deepEqual(report.deletionWhitelist.sort(), DEFAULT_SEED_ACCOUNTS.map((seed) => seed.id).sort());
});

test("apply deletes exactly five seeds in one commit path and leaves transactions unchanged", async () => {
  const db = makeDb();
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "unit" });

  assert.equal(report.writesPerformed, 5);
  assert.equal(report.deletedIds.length, 5);
  assert.equal(db.count("accounts"), 5);
  assert.equal(db.count("transactions"), 10);
  assert.deepEqual(report.after.accountIds.sort(), Object.values(CANONICAL_ACCOUNTS).sort());
});

test("seed with transaction is refused before commit", async () => {
  const db = makeDb({ seedReference: DEFAULT_SEED_ACCOUNTS[0].id });
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "unit" });

  assert.equal(report.writesPerformed, 0);
  assert.equal(db.count("accounts"), 10);
  assert.ok(report.guards.some((guard) => guard.includes("transaction reference")));
});

test("seed referenced by fixed expense, recurring income, or opportunity is refused", async () => {
  for (const options of [
    { fixedExpenseReference: DEFAULT_SEED_ACCOUNTS[1].id },
    { recurringReference: DEFAULT_SEED_ACCOUNTS[2].id },
    { opportunityReference: DEFAULT_SEED_ACCOUNTS[3].id },
  ]) {
    const db = makeDb(options);
    const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "unit" });
    assert.equal(report.writesPerformed, 0);
    assert.equal(db.count("accounts"), 10);
    assert.ok(report.guards.some((guard) => guard.includes("non-transaction reference")));
  }
});

test("seed with non-zero initialBalance is refused", async () => {
  const db = makeDb({ seedInitialBalance: 1 });
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "unit" });

  assert.equal(report.writesPerformed, 0);
  assert.ok(report.guards.some((guard) => guard.includes("non-zero initialBalance")));
});

test("ambiguous canonical account is refused", async () => {
  const db = makeDb({ ambiguousCanonical: true });
  const report = await runCleanupWithDb({ db, projectId: EXPECTED_PROJECT_ID, apply: true, source: "unit" });

  assert.equal(report.writesPerformed, 0);
  assert.ok(report.guards.some((guard) => guard.includes("exactly one non-default canonical")));
});

test("wrong project and generic apply flag contract are explicit", async () => {
  await assert.rejects(
    () => runCleanupWithDb({ db: makeDb(), projectId: "wrong-project", apply: true, source: "unit" }),
    /--project must be exactly budget-alexandre/
  );
  assert.equal(APPLY_FLAG, "--apply-confirmed-cleanup-5-default-accounts");
});
