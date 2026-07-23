import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFixedExpenseDuplicateMergeReport,
  selectCanonicalFixedExpense,
} from "./fixedExpenseDuplicateMerge.js";
import {
  APPLY_FLAG,
  AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS,
  AUTHORIZED_FIXED_EXPENSE_DELETE_IDS,
  buildWritePlan,
  runFixedExpenseDuplicateMergeWithDb,
} from "../../scripts/maintenance/merge-duplicate-fixed-expenses.mjs";

function fixedExpense(id, overrides = {}) {
  return {
    id,
    name: "Telephone",
    accountId: "account-current",
    categoryId: "category-subscriptions",
    frequency: "monthly",
    initialAmount: 15.99,
    startDate: "2026-01-05",
    endDate: null,
    variations: [],
    isActive: true,
    createdAt: overrides.createdAt || "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function transaction(id, fixedExpenseId, overrides = {}) {
  return {
    id,
    date: "2026-07-05",
    type: "depense",
    montant: 15.99,
    fixedExpenseId,
    ...overrides,
  };
}

function baseState(overrides = {}) {
  return {
    fixedExpenses: overrides.fixedExpenses || [],
    transactions: overrides.transactions || [],
    accounts: [{ id: "account-current", name: "Compte courant" }],
    categories: [{ id: "category-subscriptions", name: "Abonnements" }, { id: "category-tax", name: "Impots" }],
    subcategories: [],
    thirdParties: [],
    projects: [],
    activities: [],
  };
}

function authorizedProductionState(overrides = {}) {
  const [taxCanonical, phoneCanonical] = AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS;
  const [taxDuplicate, ...phoneDuplicates] = AUTHORIZED_FIXED_EXPENSE_DELETE_IDS;
  return baseState({
    fixedExpenses: [
      fixedExpense("KTeNytiDvtOM8z7RuaZT", { name: "Assurance voiture", initialAmount: 110.01, startDate: "2026-07-10" }),
      fixedExpense("rD0OvN9mr7JS71a4Y9Qp", { name: "Chat GPT", initialAmount: 23, startDate: "2026-06-16" }),
      fixedExpense("bAnx9hMT9EB1yU70puRg", { name: "Eau", initialAmount: 10.09, startDate: "2026-07-10" }),
      fixedExpense("dVxNSsip1NwzmJc9I7TN", { name: "Electricite", initialAmount: 40, startDate: "2026-06-11" }),
      fixedExpense("XnhZmesyyuV3FhQrzhrz", { name: "Google", initialAmount: 1, startDate: "2026-06-29" }),
      fixedExpense(taxDuplicate, { name: "Impots Prlv a la source", categoryId: "category-tax", initialAmount: 29, startDate: "2026-06-15", isActive: true, createdAt: "2026-01-02T00:00:00.000Z" }),
      fixedExpense(taxCanonical, { name: "Impots Prlv a la source", categoryId: "category-tax", initialAmount: 29, startDate: "2026-06-15", isActive: false, createdAt: "2026-01-01T00:00:00.000Z" }),
      fixedExpense("Xed6IZ9z5ZFk1WF8Acmy", { name: "Keepcool", categoryId: "category-leisure", initialAmount: 29.99, startDate: "2026-06-02" }),
      fixedExpense("2zovmFQPP3Bj1b8aaMCZ", { name: "Loyer", categoryId: "category-housing", initialAmount: 658.44, startDate: "2026-07-06" }),
      fixedExpense("s6dagMLxjgjvORQ2EKPG", { name: "Mutuelle MSA", categoryId: "category-health", initialAmount: 14, startDate: "2026-06-15" }),
      fixedExpense("sJBesKzDWfGl8nx0UJ6k", { name: "Podcats papacito", categoryId: "category-leisure", initialAmount: 6, startDate: "2026-06-25" }),
      fixedExpense(phoneDuplicates[0], { name: "Telephone", initialAmount: 15.99, startDate: "2026-07-09", isActive: false, createdAt: "2026-01-02T00:00:00.000Z" }),
      fixedExpense(phoneDuplicates[1], { name: "Telephone", initialAmount: 15.99, startDate: "2026-07-09", isActive: false, createdAt: "2026-01-03T00:00:00.000Z" }),
      fixedExpense(phoneCanonical, { name: "Telephone", initialAmount: 15.99, startDate: "2026-07-09", isActive: true, createdAt: "2026-01-01T00:00:00.000Z" }),
      fixedExpense(phoneDuplicates[2], { name: "Telephone", initialAmount: 15.99, startDate: "2026-07-09", isActive: false, createdAt: "2026-01-04T00:00:00.000Z" }),
    ],
    transactions: Array.from({ length: 208 }, (_, index) => ({
      id: `tx-${String(index + 1).padStart(3, "0")}`,
      date: "2026-07-05",
      type: "depense",
      montant: 1,
    })),
    categories: [
      { id: "category-subscriptions", name: "Abonnements" },
      { id: "category-tax", name: "Impots" },
      { id: "category-leisure", name: "Loisirs" },
      { id: "category-housing", name: "Logement" },
      { id: "category-health", name: "Sante" },
    ],
    ...overrides,
  });
}

class FakeBatch {
  constructor(db) {
    this.db = db;
    this.operations = [];
  }

  update(ref, payload) {
    this.operations.push({ type: "update", ref, payload });
  }

  delete(ref) {
    this.operations.push({ type: "delete", ref });
  }

  async commit() {
    if (this.db.failCommit) {
      throw new Error("batch interrupted");
    }

    for (const operation of this.operations) {
      const collection = this.db.state[operation.ref.collectionName];
      if (operation.type === "update") {
        const item = collection.find((entry) => entry.id === operation.ref.id);
        Object.assign(item, operation.payload);
      }
      if (operation.type === "delete") {
        this.db.state[operation.ref.collectionName] = collection.filter((entry) => entry.id !== operation.ref.id);
      }
    }
  }
}

class FakeDb {
  constructor(state, { failCommit = false } = {}) {
    this.state = structuredClone(state);
    this.failCommit = failCommit;
  }

  collection(collectionName) {
    return {
      get: async () => ({
        docs: (this.state[collectionName] || []).map((entry) => ({
          id: entry.id,
          data: () => {
            const { id, ...data } = entry;
            return structuredClone(data);
          },
        })),
      }),
      doc: (id) => ({ collectionName, id }),
    };
  }

  batch() {
    return new FakeBatch(this);
  }
}

test("1 fiche ne produit aucun groupe de doublons ni ecriture", () => {
  const report = buildFixedExpenseDuplicateMergeReport(baseState({
    fixedExpenses: [fixedExpense("fx-one")],
  }));

  assert.equal(report.duplicateGroups.length, 0);
  assert.equal(buildWritePlan(report).writeCount, 0);
});

test("2 doublons choisissent la fiche avec le plus de transactions liees", () => {
  const report = buildFixedExpenseDuplicateMergeReport(baseState({
    fixedExpenses: [fixedExpense("fx-old"), fixedExpense("fx-linked", { createdAt: "2026-02-01T00:00:00.000Z" })],
    transactions: [transaction("tx-1", "fx-linked"), transaction("tx-2", "fx-linked")],
  }));

  assert.equal(report.duplicateGroups.length, 1);
  assert.equal(report.duplicateGroups[0].canonicalId, "fx-linked");
  assert.deepEqual(report.duplicateGroups[0].duplicateIds, ["fx-old"]);
});

test("4 doublons sans transaction choisissent la plus ancienne puis l'ID Firestore", () => {
  const group = [
    fixedExpense("fx-d", { createdAt: "2026-01-03T00:00:00.000Z" }),
    fixedExpense("fx-b", { createdAt: "2026-01-01T00:00:00.000Z" }),
    fixedExpense("fx-a", { createdAt: "2026-01-01T00:00:00.000Z" }),
    fixedExpense("fx-c", { createdAt: "2026-01-02T00:00:00.000Z" }),
  ];

  assert.equal(selectCanonicalFixedExpense(group).id, "fx-a");
});

test("transactions liees sont planifiees vers le canonique sans perte de lien", () => {
  const report = buildFixedExpenseDuplicateMergeReport(baseState({
    fixedExpenses: [fixedExpense("fx-canonical"), fixedExpense("fx-duplicate", { createdAt: "2026-02-01T00:00:00.000Z" })],
    transactions: [
      transaction("tx-canonical-1", "fx-canonical"),
      transaction("tx-canonical-2", "fx-canonical"),
      transaction("tx-linked", "fx-duplicate"),
    ],
  }));
  const plan = buildWritePlan(report);

  assert.deepEqual(plan.transactionUpdates, [{
    transactionId: "tx-linked",
    fromFixedExpenseId: "fx-duplicate",
    toFixedExpenseId: "fx-canonical",
  }]);
  assert.deepEqual(plan.fixedExpenseDeletes, ["fx-duplicate"]);
});

test("previsions avant/apres retirent uniquement la recurrence du doublon", () => {
  const report = buildFixedExpenseDuplicateMergeReport({
    ...baseState({
      fixedExpenses: [
        fixedExpense("fx-canonical", { initialAmount: 10 }),
        fixedExpense("fx-duplicate", { initialAmount: 10, createdAt: "2026-02-01T00:00:00.000Z" }),
      ],
    }),
    year: 2026,
  });

  const july = report.comparison.monthlyForecasts.find((month) => month.month === "2026-07");
  assert.equal(july.before, 20);
  assert.equal(july.after, 10);
  assert.equal(july.delta, -10);
});

test("garde-fou refuse une transaction orpheline", () => {
  const report = buildFixedExpenseDuplicateMergeReport(baseState({
    fixedExpenses: [fixedExpense("fx-one")],
    transactions: [transaction("tx-orphan", "fx-missing")],
  }));

  assert.equal(report.verdict, "DRY_RUN_REFUSED");
  assert.deepEqual(report.orphanTransactions, [{ transactionId: "tx-orphan", fixedExpenseId: "fx-missing" }]);
});

test("fiches ressemblantes incompatibles sont rapportees sans fusion", () => {
  const report = buildFixedExpenseDuplicateMergeReport(baseState({
    fixedExpenses: [
      fixedExpense("fx-phone"),
      fixedExpense("fx-phone-tax", { categoryId: "category-tax" }),
    ],
  }));

  assert.equal(report.duplicateGroups.length, 0);
  assert.equal(report.incompatibleGroups.length, 1);
});

test("suppression annulee en dry-run ne modifie pas l'etat", async () => {
  const state = baseState({
    fixedExpenses: [fixedExpense("fx-canonical"), fixedExpense("fx-duplicate", { createdAt: "2026-02-01T00:00:00.000Z" })],
    transactions: [
      transaction("tx-canonical-1", "fx-canonical"),
      transaction("tx-canonical-2", "fx-canonical"),
      transaction("tx-linked", "fx-duplicate"),
    ],
  });
  const db = new FakeDb(state);
  const report = await runFixedExpenseDuplicateMergeWithDb({
    db,
    projectId: "budget-alexandre",
    apply: false,
    source: "emulator:test",
    year: 2026,
  });

  assert.equal(report.mode, "dry-run");
  assert.equal(db.state.fixedExpenses.length, 2);
  assert.equal(db.state.transactions.find((entry) => entry.id === "tx-linked").fixedExpenseId, "fx-duplicate");
});

test("suppression atomique applique uniquement la liste blanche autorisee", async () => {
  const state = authorizedProductionState();
  const db = new FakeDb(state);
  const report = await runFixedExpenseDuplicateMergeWithDb({
    db,
    projectId: "budget-alexandre",
    apply: true,
    source: "emulator:test",
    year: 2026,
  });

  assert.equal(report.verdict, "MERGE_APPLIED_OK");
  assert.deepEqual(buildWritePlan(report).fixedExpenseDeletes, AUTHORIZED_FIXED_EXPENSE_DELETE_IDS);
  assert.equal(db.state.fixedExpenses.length, 11);
  assert.deepEqual(
    AUTHORIZED_FIXED_EXPENSE_DELETE_IDS.filter((id) => db.state.fixedExpenses.some((entry) => entry.id === id)),
    []
  );
  assert.equal(db.state.transactions.length, 208);
  assert.equal(db.state.transactions.some((entry) => entry.fixedExpenseId), false);
});

test("apply refuse un ID hors liste blanche", async () => {
  const state = authorizedProductionState({
    fixedExpenses: authorizedProductionState().fixedExpenses.map((entry) =>
      entry.id === "OLEn0ZuMLensdL7Zpr4H"
        ? { ...entry, id: "fx-not-authorized" }
        : entry
    ),
  });
  const db = new FakeDb(state);

  await assert.rejects(
    runFixedExpenseDuplicateMergeWithDb({
      db,
      projectId: "budget-alexandre",
      apply: true,
      source: "emulator:test",
      year: 2026,
    }),
    /liste destructive non autorisee/
  );
  assert.equal(db.state.fixedExpenses.length, 15);
});

test("apply refuse la suppression d'un canonique", async () => {
  const state = authorizedProductionState({
    fixedExpenses: authorizedProductionState().fixedExpenses.map((entry) =>
      entry.id === "Lwf4ibPfj7ckq1a5a7Or"
        ? { ...entry, createdAt: "2026-01-06T00:00:00.000Z" }
        : entry
    ),
  });
  const db = new FakeDb(state);

  await assert.rejects(
    runFixedExpenseDuplicateMergeWithDb({
      db,
      projectId: "budget-alexandre",
      apply: true,
      source: "emulator:test",
      year: 2026,
    }),
    /tentative de suppression du canonique|liste destructive non autorisee/
  );
});

test("flag apply explicite documente le seul mode destructif autorise", () => {
  assert.equal(APPLY_FLAG, "--apply-confirmed-fixed-expense-merge");
});

test("batch interrompu laisse l'etat intact", async () => {
  const state = authorizedProductionState();
  const db = new FakeDb(state, { failCommit: true });

  await assert.rejects(
    runFixedExpenseDuplicateMergeWithDb({
      db,
      projectId: "budget-alexandre",
      apply: true,
      source: "emulator:test",
      year: 2026,
    }),
    /batch interrupted/
  );
  assert.equal(db.state.fixedExpenses.length, 15);
  assert.equal(db.state.transactions.length, 208);
});
