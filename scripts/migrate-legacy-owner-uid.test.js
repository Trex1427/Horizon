import test from "node:test";
import assert from "node:assert/strict";
import {
  SOURCE_OWNER_UID,
  TARGET_OWNER_UID,
  applyCandidates,
  scanRootCollections,
} from "./migrate-legacy-owner-uid.mjs";

function fakeDb(initial) {
  const store = new Map(Object.entries(initial));
  const writes = [];
  const refs = new Map([...store.keys()].map((path) => [path, { path }]));
  return {
    store,
    writes,
    async listCollections() {
      const names = [...new Set([...store.keys()].map((path) => path.split("/")[0]))];
      return names.map((id) => ({
        id,
        async get() {
          return {
            docs: [...store.entries()].filter(([path]) => path.startsWith(`${id}/`) && path.split("/").length === 2).map(([path, data]) => ({
              id: path.split("/")[1], ref: refs.get(path), updateTime: `time:${path}`,
              get(field) { return data[field]; },
            })),
          };
        },
      }));
    },
    batch() {
      const pending = [];
      return {
        update(ref, patch, precondition) { pending.push({ ref, patch, precondition }); },
        async commit() {
          for (const write of pending) {
            writes.push(write);
            store.set(write.ref.path, { ...store.get(write.ref.path), ...write.patch });
          }
        },
      };
    },
  };
}

test("le dry-run scanne toutes les collections racines sans écrire", async () => {
  const db = fakeDb({
    "accounts/a": { ownerUid: SOURCE_OWNER_UID, name: "A" },
    "transactions/t": { ownerUid: TARGET_OWNER_UID, amount: 10 },
    "other/o": { ownerUid: "another-owner" },
  });
  const report = await scanRootCollections(db);
  assert.equal(report.documentsScanned, 3);
  assert.equal(report.documentsToMigrate, 1);
  assert.equal(report.candidates[0].path, "accounts/a");
  assert.equal(db.writes.length, 0);
});

test("apply écrit uniquement ownerUid par batch et un second passage est idempotent", async () => {
  const db = fakeDb({
    "accounts/a": { ownerUid: SOURCE_OWNER_UID, name: "inchangé" },
    "transactions/t": { ownerUid: SOURCE_OWNER_UID, amount: 10 },
  });
  const firstScan = await scanRootCollections(db);
  const result = await applyCandidates(db, firstScan.candidates, 1);
  assert.equal(result.modified, 2);
  assert.deepEqual(db.writes.map((write) => write.patch), [
    { ownerUid: TARGET_OWNER_UID }, { ownerUid: TARGET_OWNER_UID },
  ]);
  assert.deepEqual(db.store.get("accounts/a"), { ownerUid: TARGET_OWNER_UID, name: "inchangé" });

  const secondScan = await scanRootCollections(db);
  assert.equal(secondScan.documentsToMigrate, 0);
  const secondResult = await applyCandidates(db, secondScan.candidates, 1);
  assert.equal(secondResult.modified, 0);
  assert.equal(db.writes.length, 2);
});
