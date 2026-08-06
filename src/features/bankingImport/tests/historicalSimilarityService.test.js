import test from "node:test";
import assert from "node:assert/strict";
import {
  HISTORICAL_SIMILARITY_LIMIT,
  applyClassificationToOwnedHistory,
  searchOwnedHistoricalTransactions,
} from "../services/historicalSimilarityService.js";
import { findSimilarUnvalidatedImportRows } from "../utils/classificationBatchAssistant.js";

const auth = (uid = "owner-a") => ({ currentUser: { uid } });
const source = {
  sourceRowIndex: 1,
  rawLabel: "CARTE X2648 KEEP COOL 05/01",
  amount: -29.99,
  type: "depense",
  accountId: "acc-1",
  operationDate: "2026-01-05",
  categoryId: "cat-1",
  categoryName: "Sport",
  subcategoryId: "sub-1",
  subcategoryName: "Salle",
  thirdPartyId: "third-1",
  thirdPartyName: "Keep Cool",
  activityId: "activity-1",
  activityName: "Personnel",
  projectId: "project-1",
  projectName: "Santé",
};

function transaction(id, overrides = {}) {
  return {
    id,
    historyTransactionId: id,
    ownerUid: "owner-a",
    type: "depense",
    montant: 29.99,
    date: "2026-02-05",
    description: "KEEP COOL 05/02",
    accountId: "acc-1",
    ...overrides,
  };
}

test("history search is owner-scoped, type-scoped and bounded", async () => {
  const calls = [];
  const transport = { async search(criteria) { calls.push(criteria); return [transaction("tx-1")]; } };
  const result = await searchOwnedHistoricalTransactions(source, { auth: auth(), transport, cache: new Map(), resultLimit: 9999 });
  assert.equal(result.length, 1);
  assert.deepEqual(calls, [{ ownerUid: "owner-a", type: "depense", resultLimit: HISTORICAL_SIMILARITY_LIMIT }]);
});

test("transactions owned by another user are never returned", async () => {
  const transport = { async search() { return [transaction("owned"), transaction("foreign", { ownerUid: "owner-b" })]; } };
  const result = await searchOwnedHistoricalTransactions(source, { auth: auth(), transport, cache: new Map() });
  assert.deepEqual(result.map((row) => row.historyTransactionId), ["owned"]);
});

test("identical historical searches reuse the import-scoped cache", async () => {
  let calls = 0;
  const cache = new Map();
  const transport = { async search() { calls += 1; return [transaction("tx-1")]; } };
  await searchOwnedHistoricalTransactions(source, { auth: auth(), transport, cache });
  await searchOwnedHistoricalTransactions(source, { auth: auth(), transport, cache });
  assert.equal(calls, 1);
});

test("import-only, history-only, merged and empty results use the same matcher", async () => {
  const transport = { async search() { return [transaction("tx-history")]; } };
  const history = await searchOwnedHistoricalTransactions(source, { auth: auth(), transport, cache: new Map() });
  const imported = [{ sourceRowIndex: 2, rawLabel: "KEEP COOL", amount: -29.99, type: "depense" }];
  const importMatches = findSimilarUnvalidatedImportRows(imported, source);
  const historyMatches = findSimilarUnvalidatedImportRows(history, source);
  assert.equal(importMatches.length, 1);
  assert.equal(historyMatches.length, 1);
  assert.equal([...importMatches, ...historyMatches].length, 2);
  assert.equal(findSimilarUnvalidatedImportRows([], source).length, 0);
});

test("historical application writes only classification fields", async () => {
  const writes = [];
  const transport = { async updateClassifications(ownerUid, updates) { writes.push({ ownerUid, updates }); } };
  const owned = transaction("tx-1");
  const count = await applyClassificationToOwnedHistory(source, [owned], { auth: auth(), transport });
  assert.equal(count, 1);
  assert.equal(writes[0].ownerUid, "owner-a");
  assert.deepEqual(Object.keys(writes[0].updates[0].patch).sort(), [
    "activityId", "activityName", "categoryId", "categoryName", "projectId", "projectName",
    "subcategoryId", "subcategoryName", "thirdPartyId", "thirdPartyName",
  ]);
  for (const forbidden of ["amount", "montant", "date", "accountId", "description"]) {
    assert.equal(forbidden in writes[0].updates[0].patch, false);
  }
});

test("partial historical application updates only selected rows", async () => {
  let updates = [];
  const transport = { async updateClassifications(ownerUid, nextUpdates) { updates = nextUpdates; } };
  await applyClassificationToOwnedHistory(source, [transaction("selected")], { auth: auth(), transport });
  assert.deepEqual(updates.map((entry) => entry.id), ["selected"]);
});

test("historical application rejects a foreign transaction before writing", async () => {
  let wrote = false;
  const transport = { async updateClassifications() { wrote = true; } };
  await assert.rejects(
    () => applyClassificationToOwnedHistory(source, [transaction("foreign", { ownerUid: "owner-b" })], { auth: auth(), transport }),
    /non autorisée/
  );
  assert.equal(wrote, false);
});
