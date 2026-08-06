import test from "node:test";
import assert from "node:assert/strict";
import { buildSeedDocuments, deleteCandidates, findExistingSeedDocumentPaths, scanOwnedRootDocuments, seedMinimalEnvironment } from "./reset-user-environment.mjs";

const OWNER = "owner-user-123";
const OTHER = "other-user-456";

function fakeDb(initial = {}) {
  const store = new Map(Object.entries(initial));
  const commits = [];
  const refFor = (path) => ({ path, id: path.split("/").at(-1) });
  return {
    store, commits,
    collection(name) {
      return {
        id: name,
        doc(id) { return refFor(`${name}/${id}`); },
        async get() {
          return { docs: [...store.entries()].filter(([path]) => path.split("/").length === 2 && path.startsWith(`${name}/`)).map(([path, data]) => ({
            id: path.split("/")[1], ref: refFor(path), updateTime: `v:${path}`,
            get(field) { return data[field]; },
            data() { return data; },
          })) };
        },
      };
    },
    async listCollections() {
      return [...new Set([...store.keys()].map((path) => path.split("/")[0]))].map((name) => this.collection(name));
    },
    batch() {
      const operations = [];
      return {
        delete(ref, precondition) { operations.push({ type: "delete", ref, precondition }); },
        create(ref, data) { operations.push({ type: "create", ref, data }); },
        async commit() {
          for (const operation of operations) {
            if (operation.type === "create" && store.has(operation.ref.path)) throw new Error("already exists");
          }
          for (const operation of operations) {
            if (operation.type === "delete") store.delete(operation.ref.path);
            else store.set(operation.ref.path, operation.data);
          }
          commits.push(operations);
        },
      };
    },
  };
}

test("simulation scanne sans supprimer", async () => {
  const db = fakeDb({ "accounts/a": { ownerUid: OWNER }, "transactions/t": { ownerUid: OTHER }, "misc/m": { value: 1 } });
  const report = await scanOwnedRootDocuments(db, OWNER);
  assert.equal(report.documentsScanned, 3);
  assert.equal(report.deletable, 1);
  assert.equal(db.store.size, 3);
  assert.equal(db.commits.length, 0);
});

test("suppression protège les autres ownerUid et les documents sans ownerUid", async () => {
  const db = fakeDb({ "accounts/owned": { ownerUid: OWNER }, "accounts/other": { ownerUid: OTHER }, "accounts/no-owner": { name: "x" } });
  const report = await scanOwnedRootDocuments(db, OWNER);
  const result = await deleteCandidates(db, report.candidates);
  assert.equal(result.deleted, 1);
  assert.equal(db.store.has("accounts/owned"), false);
  assert.equal(db.store.has("accounts/other"), true);
  assert.equal(db.store.has("accounts/no-owner"), true);
});

test("suppression est idempotente", async () => {
  const db = fakeDb({ "accounts/a": { ownerUid: OWNER } });
  await deleteCandidates(db, (await scanOwnedRootDocuments(db, OWNER)).candidates);
  const second = await scanOwnedRootDocuments(db, OWNER);
  const result = await deleteCandidates(db, second.candidates);
  assert.equal(result.deleted, 0);
  assert.equal(result.errors.length, 0);
});

test("batching ne dépasse jamais 400 opérations", async () => {
  const initial = Object.fromEntries(Array.from({ length: 805 }, (_, index) => [`items/${index}`, { ownerUid: OWNER }]));
  const db = fakeDb(initial);
  await deleteCandidates(db, (await scanOwnedRootDocuments(db, OWNER)).candidates);
  assert.deepEqual(db.commits.map((batch) => batch.length), [400, 400, 5]);
});

test("seed crée uniquement compte, catégories et sous-catégories", async () => {
  const db = fakeDb();
  const planned = buildSeedDocuments(db, OWNER, new Date("2026-01-01T00:00:00Z"));
  const result = await seedMinimalEnvironment(db, OWNER);
  assert.equal(result.created, planned.length);
  assert.deepEqual(new Set([...db.store.keys()].map((path) => path.split("/")[0])), new Set(["accounts", "categories", "subcategories"]));
  const account = [...db.store.entries()].find(([path]) => path.startsWith("accounts/"))[1];
  assert.deepEqual({ name: account.name, initialBalance: account.initialBalance, type: account.type, isActive: account.isActive, displayOrder: account.displayOrder, ownerUid: account.ownerUid },
    { name: "Compte courant", initialBalance: 0, type: "standard", isActive: true, displayOrder: 0, ownerUid: OWNER });
  assert.equal([...db.store.values()].every((document) => document.ownerUid === OWNER), true);
});



test("seed lancé 2 fois ne crée aucun doublon et conserve timestamps et IDs", async () => {
  const db = fakeDb();
  await seedMinimalEnvironment(db, OWNER);
  const paths = [...db.store.keys()];
  const timestamps = new Map([...db.store].map(([path, data]) => [path, { createdAt: data.createdAt, updatedAt: data.updatedAt }]));
  const commits = db.commits.length;
  const second = await seedMinimalEnvironment(db, OWNER);
  assert.equal(second.created, 0);
  assert.equal(second.errors.length, 0);
  assert.equal(db.commits.length, commits);
  assert.deepEqual([...db.store.keys()], paths);
  for (const [path, data] of db.store) {
    assert.equal(data.createdAt, timestamps.get(path).createdAt);
    assert.equal(data.updatedAt, timestamps.get(path).updatedAt);
  }
});

test("seed lancé 5 fois n'effectue aucune écriture supplémentaire", async () => {
  const db = fakeDb();
  await seedMinimalEnvironment(db, OWNER);
  const commits = db.commits.length;
  const state = [...db.store.entries()];
  for (let run = 0; run < 4; run += 1) {
    const result = await seedMinimalEnvironment(db, OWNER);
    assert.equal(result.created, 0);
  }
  assert.equal(db.commits.length, commits);
  assert.deepEqual([...db.store.entries()], state);
});

test("seed réutilise les IDs existants sans modifier les timestamps", async () => {
  const createdAt = new Date("2020-01-01T00:00:00Z");
  const updatedAt = new Date("2021-01-01T00:00:00Z");
  const db = fakeDb({
    "accounts/custom-current-id": { name: "  COMPTE COURANT ", ownerUid: OWNER, createdAt, updatedAt },
    "categories/custom-transport-id": { name: "Transport", type: "depense", ownerUid: OWNER, createdAt, updatedAt },
    "subcategories/custom-fuel-id": { name: "Carburant", categoryId: "custom-transport-id", ownerUid: OWNER, createdAt, updatedAt },
  });
  await seedMinimalEnvironment(db, OWNER);
  assert.equal(db.store.has("accounts/custom-current-id"), true);
  assert.equal(db.store.has("categories/custom-transport-id"), true);
  assert.equal(db.store.has("subcategories/custom-fuel-id"), true);
  assert.equal(db.store.get("accounts/custom-current-id").createdAt, createdAt);
  assert.equal(db.store.get("accounts/custom-current-id").updatedAt, updatedAt);
  assert.equal([...db.store.values()].filter((data) => String(data.name || "").trim().toLowerCase() === "compte courant").length, 1);
  assert.equal([...db.store.values()].filter((data) => data.categoryId === "custom-transport-id" && data.name === "Carburant").length, 1);
});

test("reset puis seed restaure le même environnement fonctionnel", async () => {
  const db = fakeDb();
  await seedMinimalEnvironment(db, OWNER);
  const expected = functionalState(db.store);
  await deleteCandidates(db, (await scanOwnedRootDocuments(db, OWNER)).candidates);
  await seedMinimalEnvironment(db, OWNER);
  assert.deepEqual(functionalState(db.store), expected);
});

function functionalState(store) {
  return [...store.entries()].map(([path, data]) => ({
    path,
    ...Object.fromEntries(Object.entries(data).filter(([key]) => !["createdAt", "updatedAt"].includes(key))),
  }));
}
test("apply avec seed supprime toutes les données métier puis recrée uniquement l'état initial", async () => {
  const db = fakeDb({
    "accounts/old": { ownerUid: OWNER, name: "Ancien compte" },
    "transactions/t": { ownerUid: OWNER },
    "budgets/b": { ownerUid: OWNER },
    "thirdParties/tp": { ownerUid: OWNER },
    "projects/p": { ownerUid: OWNER },
    "fixedExpenses/f": { ownerUid: OWNER },
    "activities/a": { ownerUid: OWNER },
    "debts/d": { ownerUid: OWNER },
    "objectives/o": { ownerUid: OWNER },
  });
  await deleteCandidates(db, (await scanOwnedRootDocuments(db, OWNER)).candidates);
  await seedMinimalEnvironment(db, OWNER);

  assert.deepEqual(new Set([...db.store.keys()].map((path) => path.split("/")[0])), new Set(["accounts", "categories", "subcategories"]));
  const accounts = [...db.store.entries()].filter(([path]) => path.startsWith("accounts/"));
  assert.equal(accounts.length, 1);
  assert.equal(accounts[0][1].name, "Compte courant");
  assert.equal(accounts[0][1].isDefault, true);
  assert.equal(accounts[0][1].initialBalance, 0);
});
