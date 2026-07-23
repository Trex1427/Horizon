import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpportunityLinkedTransactionPayload,
  buildOpportunityTransactionDraft,
  createOpportunityTransactionAdapter,
  didOpportunityBecomeRealized,
  isOpportunityRealized,
} from "./opportunityTransactionLink.js";

function createMemoryAdapter(initial = {}) {
  const store = {
    opportunities: new Map(Object.entries(initial.opportunities || {})),
    transactions: new Map(Object.entries(initial.transactions || {})),
  };
  let nextTransactionId = 1;
  let queue = Promise.resolve();

  function createDocRef(collectionName, id = "") {
    const refId = id || `tx-${nextTransactionId}`;
    if (!id) nextTransactionId += 1;
    return { collectionName, id: refId };
  }

  function getCollection(ref) {
    return store[ref.collectionName];
  }

  function transactionRunner(callback) {
    const run = queue.then(() => callback({
      async get(ref) {
        const collection = getCollection(ref);
        const data = collection.get(ref.id);
        return {
          exists: () => Boolean(data),
          data: () => ({ ...(data || {}) }),
        };
      },
      set(ref, payload) {
        getCollection(ref).set(ref.id, { ...payload });
      },
      update(ref, patch) {
        const collection = getCollection(ref);
        collection.set(ref.id, { ...(collection.get(ref.id) || {}), ...patch });
      },
    }));
    queue = run.catch(() => {});
    return run;
  }

  return {
    store,
    createLinkedTransaction: createOpportunityTransactionAdapter({
      transactionRunner,
      createDocRef,
      resolveOwnerUid: initial.resolveOwnerUid,
      now: () => "2026-07-15T10:00:00.000Z",
    }),
  };
}

test("realized opportunity helpers detect status transition", () => {
  assert.equal(isOpportunityRealized({ status: "Realise" }), true);
  assert.equal(isOpportunityRealized({ status: "Réalisé" }), true);
  assert.equal(isOpportunityRealized({ status: "Probable" }), false);
  assert.equal(didOpportunityBecomeRealized({ status: "Probable" }, { status: "Realise" }), true);
  assert.equal(didOpportunityBecomeRealized({ status: "Realise" }, { status: "Realise" }), false);
});

test("buildOpportunityTransactionDraft prefills editable income fields", () => {
  const draft = buildOpportunityTransactionDraft({
    id: "opp-1",
    name: "Prime chantier",
    description: "Solde facture",
    comment: "A verifier",
    estimatedAmount: 1200,
    realizedAmount: 1180,
    estimatedDate: "2026-08-20",
    realizedDate: "2026-08-18",
    accountId: "acc-1",
    categoryId: "cat-income",
    categoryName: "Prestations",
    projectId: "project-1",
    thirdPartyId: "third-1",
    activityId: "activity-1",
  }, {
    projects: [{ id: "project-1", name: "Projet" }],
    thirdParties: [{ id: "third-1", name: "Client" }],
    activities: [{ id: "activity-1", name: "Activite" }],
  });

  assert.equal(draft.type, "revenu");
  assert.equal(draft.description, "Prime chantier");
  assert.equal(draft.montant, "1180");
  assert.equal(draft.date, "2026-08-18");
  assert.equal(draft.accountId, "acc-1");
  assert.equal(draft.categoryId, "cat-income");
  assert.equal(draft.projectId, "project-1");
  assert.equal(draft.thirdPartyId, "third-1");
  assert.equal(draft.activityId, "activity-1");
  assert.equal(draft.opportunityId, "opp-1");
  assert.equal(draft.opportunityNotes, "Solde facture - A verifier");
});

test("cancelling the prefilled form creates no transaction and no link", () => {
  const adapter = createMemoryAdapter({
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise" },
    },
  });

  assert.equal(adapter.store.transactions.size, 0);
  assert.equal(adapter.store.opportunities.get("opp-1").realizedTransactionId, undefined);
});

test("linked transaction creation stores opportunityId and back link", async () => {
  const adapter = createMemoryAdapter({
    resolveOwnerUid: () => "uid-owner-test",
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise", name: "Prime" },
    },
  });

  const result = await adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: buildOpportunityLinkedTransactionPayload({
      date: "2026-08-18",
      montant: 1180,
      type: "revenu",
      description: "Prime",
    }, { id: "opp-1", name: "Prime" }),
  });

  assert.equal(result.status, "created");
  assert.equal(adapter.store.transactions.size, 1);
  assert.equal(adapter.store.transactions.get(result.transactionId).opportunityId, "opp-1");
  assert.equal(adapter.store.transactions.get(result.transactionId).ownerUid, "uid-owner-test");
  assert.equal(adapter.store.opportunities.get("opp-1").realizedTransactionId, result.transactionId);
});

test("linked transaction creation strips forged owner fields", async () => {
  const adapter = createMemoryAdapter({
    resolveOwnerUid: () => "uid-owner-test",
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise" },
    },
  });

  const result = await adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: {
      date: "2026-08-18",
      montant: 1180,
      type: "revenu",
      ownerUid: "attacker",
      createdBy: "attacker",
      userId: "attacker",
      uid: "attacker",
      ownerId: "attacker",
    },
  });

  const created = adapter.store.transactions.get(result.transactionId);
  assert.equal(created.ownerUid, "uid-owner-test");
  assert.equal(created.createdBy, undefined);
  assert.equal(created.userId, undefined);
  assert.equal(created.uid, undefined);
  assert.equal(created.ownerId, undefined);
});

test("existing link prevents second transaction after reload or double submit", async () => {
  const adapter = createMemoryAdapter({
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise" },
    },
  });

  const first = await adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: { date: "2026-08-18", montant: 1180, type: "revenu" },
  });
  const second = await adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: { date: "2026-08-18", montant: 1180, type: "revenu" },
  });

  assert.equal(first.status, "created");
  assert.equal(second.status, "already_exists");
  assert.equal(adapter.store.transactions.size, 1);
});

test("ten concurrent creations produce a single linked transaction", async () => {
  const adapter = createMemoryAdapter({
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise" },
    },
  });

  const results = await Promise.all(Array.from({ length: 10 }, () => adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: { date: "2026-08-18", montant: 1180, type: "revenu" },
  })));

  assert.equal(results.filter((result) => result.status === "created").length, 1);
  assert.equal(results.filter((result) => result.status === "already_exists").length, 9);
  assert.equal(adapter.store.transactions.size, 1);
});

test("deleted linked transaction can be recreated only after explicit create call", async () => {
  const adapter = createMemoryAdapter({
    opportunities: {
      "opp-1": { id: "opp-1", status: "Realise", realizedTransactionId: "tx-deleted" },
    },
    transactions: {
      "tx-deleted": { id: "tx-deleted", opportunityId: "opp-1", isDeleted: true },
    },
  });

  const result = await adapter.createLinkedTransaction({
    opportunityId: "opp-1",
    transactionPayload: { date: "2026-08-18", montant: 1180, type: "revenu" },
  });

  assert.equal(result.status, "created");
  assert.equal(result.transactionId, "tx-1");
  assert.equal(adapter.store.transactions.size, 2);
  assert.equal(adapter.store.opportunities.get("opp-1").realizedTransactionId, "tx-1");
});
