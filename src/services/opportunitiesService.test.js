import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpportunityCreatePayload,
  buildOpportunityPayload,
} from "./opportunityPayloads.js";

const fixedNow = new Date("2026-07-14T12:00:00Z");

test("buildOpportunityCreatePayload normalizes the CRUD document shape", () => {
  const payload = buildOpportunityCreatePayload({
    name: " Vente Kangoo ",
    description: "Vente probable",
    estimatedAmount: "4500",
    estimatedDate: "2026-09-15",
    accountId: "account-1",
    categoryId: "cat-income",
    categoryName: "Vente",
    projectId: "project-1",
    projectName: "Garage",
    status: "Probable",
    comment: "A confirmer",
  }, fixedNow);

  assert.equal(payload.name, "Vente Kangoo");
  assert.equal(payload.estimatedAmount, 4500);
  assert.equal(payload.estimatedDate, "2026-09-15");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "probability"), false);
  assert.equal(payload.status, "Probable");
  assert.equal(payload.isActive, true);
  assert.equal(payload.isDeleted, false);
  assert.equal(payload.createdAt, fixedNow);
});

test("buildOpportunityPayload ignores legacy probability and validates status", () => {
  const high = buildOpportunityPayload({ probability: 150, status: "Inconnu" }, fixedNow);
  const low = buildOpportunityPayload({ probability: -5, status: "Confirme" }, fixedNow);

  assert.equal(Object.prototype.hasOwnProperty.call(high, "probability"), false);
  assert.equal(high.status, "A etudier");
  assert.equal(Object.prototype.hasOwnProperty.call(low, "probability"), false);
  assert.equal(low.status, "Confirme");
});

test("buildOpportunityPayload preserves inactive state and rejects invalid dates", () => {
  const payload = buildOpportunityPayload({
    estimatedDate: "not-a-date",
    isActive: false,
    estimatedAmount: "bad",
  }, fixedNow);

  assert.equal(payload.estimatedDate, null);
  assert.equal(payload.isActive, false);
  assert.equal(payload.estimatedAmount, 0);
});

test("buildOpportunityPayload keeps realized amount/date but does not write transaction link", () => {
  const payload = buildOpportunityPayload({
    status: "Realise",
    realizedAmount: "1180.50",
    realizedDate: "2026-08-18",
    realizedTransactionId: "tx-should-not-be-written-from-form",
    thirdPartyId: "third-1",
    thirdPartyName: "Client",
    activityId: "activity-1",
    activityName: "Activite",
  }, fixedNow);

  assert.equal(payload.realizedAmount, 1180.5);
  assert.equal(payload.realizedDate, "2026-08-18");
  assert.equal(payload.thirdPartyId, "third-1");
  assert.equal(payload.activityId, "activity-1");
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "realizedTransactionId"), false);
});
