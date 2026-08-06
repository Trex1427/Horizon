import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ACCOUNT_DEFINITIONS,
  buildDefaultAccountDocuments,
  hasAnyAccountDocumentsWithReader,
  initializeDefaultAccountsIfEmptyWithAdapter,
} from "./accountsDefaults.js";

function createMemoryAdapter({ hasAny = false, failRead = false, failCommit = false } = {}) {
  const documents = new Map();
  let commitCalls = 0;

  return {
    documents,
    get commitCalls() {
      return commitCalls;
    },
    hasAnyAccountDocuments: async () => {
      if (failRead) throw new Error("server unavailable");
      return hasAny || documents.size > 0;
    },
    commitDefaultAccounts: async (entries) => {
      commitCalls += 1;

      if (failCommit) {
        throw new Error("commit failed");
      }

      for (const entry of entries) {
        documents.set(entry.id, entry.data);
      }
    },
  };
}

test("default accounts use stable deterministic ids", () => {
  const documents = buildDefaultAccountDocuments({ now: () => "2026-07-13T00:00:00.000Z" });
  const ids = documents.map((document) => document.id);

  assert.deepEqual(ids, ["default-current-account"]);
  assert.equal(documents.length, 1);
  assert.equal(DEFAULT_ACCOUNT_DEFINITIONS.length, 1);
});

test("server account reader returns true when a document exists", async () => {
  assert.equal(await hasAnyAccountDocumentsWithReader(async () => ({ empty: false })), true);
});

test("server account reader returns false only for a confirmed empty snapshot", async () => {
  assert.equal(await hasAnyAccountDocumentsWithReader(async () => ({ empty: true })), false);
});

test("server account reader propagates offline, permission and timeout errors", async () => {
  for (const message of ["offline", "permission-denied", "timeout"]) {
    await assert.rejects(
      hasAnyAccountDocumentsWithReader(async () => { throw new Error(message); }),
      new RegExp(message)
    );
  }
});

test("initialization creates exactly one current account for an empty collection", async () => {
  const adapter = createMemoryAdapter();

  const result = await initializeDefaultAccountsIfEmptyWithAdapter(adapter, {
    now: () => "2026-07-13T00:00:00.000Z",
  });

  assert.equal(result.created, true);
  assert.equal(result.createdCount, 1);
  assert.equal(adapter.documents.size, 1);
});

test("second initialization is a no-op when the collection is not empty", async () => {
  const adapter = createMemoryAdapter();

  await initializeDefaultAccountsIfEmptyWithAdapter(adapter);
  const result = await initializeDefaultAccountsIfEmptyWithAdapter(adapter);

  assert.equal(result.created, false);
  assert.equal(result.createdCount, 0);
  assert.equal(adapter.documents.size, 1);
});

test("five successive initializations still finish with one current account", async () => {
  const adapter = createMemoryAdapter();

  for (let run = 0; run < 5; run += 1) {
    await initializeDefaultAccountsIfEmptyWithAdapter(adapter);
  }

  assert.equal(adapter.documents.size, 1);
});

test("a user account already present prevents default initialization", async () => {
  const adapter = createMemoryAdapter({ hasAny: true });

  const result = await initializeDefaultAccountsIfEmptyWithAdapter(adapter);

  assert.equal(result.created, false);
  assert.equal(adapter.documents.size, 0);
});

test("a failed atomic commit creates no partial in-memory documents", async () => {
  const adapter = createMemoryAdapter({ failCommit: true });

  await assert.rejects(
    initializeDefaultAccountsIfEmptyWithAdapter(adapter),
    /commit failed/
  );
  assert.equal(adapter.documents.size, 0);
});

test("a server read failure is propagated and performs no write", async () => {
  const adapter = createMemoryAdapter({ failRead: true });

  await assert.rejects(
    initializeDefaultAccountsIfEmptyWithAdapter(adapter),
    /server unavailable/
  );
  assert.equal(adapter.commitCalls, 0);
  assert.equal(adapter.documents.size, 0);
});
