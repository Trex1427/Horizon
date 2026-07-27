import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWorkProjectPayload,
  calculateWorkProjectMetrics,
  sortWorkProjects,
  WORK_PROJECT_STATUS_LABELS,
} from "./workProjectModel.js";

const acceptedQuote = {
  id: "quote-1",
  status: "accepted",
  professionalActivityId: "activity-1",
  thirdPartyId: "customer-1",
  quoteNumber: "D-42",
  amount: "1250.50",
};

test("an accepted quote creates the exact initial dossier payload", () => {
  const now = new Date("2026-07-27T10:00:00Z");
  assert.deepEqual(buildWorkProjectPayload(acceptedQuote, { ownerUid: "owner-1", thirdPartyName: "Cliente", now }), {
    ownerUid: "owner-1",
    quoteId: "quote-1",
    professionalActivityId: "activity-1",
    thirdPartyId: "customer-1",
    name: "Cliente — Devis D-42",
    status: "planned",
    plannedRevenue: 1250.5,
    plannedExpenses: 0,
    plannedMargin: 1250.5,
    startDate: null,
    endDate: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });
});

test("a non-accepted quote cannot create a dossier", () => {
  assert.throws(
    () => buildWorkProjectPayload({ ...acceptedQuote, status: "pending" }, { ownerUid: "owner-1" }),
    /Seul un devis accepté/,
  );
});

test("status labels and dossier ordering are stable", () => {
  assert.deepEqual(Object.values(WORK_PROJECT_STATUS_LABELS), ["À planifier", "En cours", "En attente", "Terminé", "Annulé"]);
  const projects = sortWorkProjects([
    { id: "completed", status: "completed", updatedAt: new Date("2026-07-27") },
    { id: "planned-old", status: "planned", updatedAt: new Date("2026-07-25") },
    { id: "planned-new", status: "planned", updatedAt: new Date("2026-07-26") },
    { id: "progress", status: "in_progress", updatedAt: new Date("2026-07-27") },
  ]);
  assert.deepEqual(projects.map(({ id }) => id), ["planned-new", "planned-old", "progress", "completed"]);
});

test("dashboard metrics exclude cancelled revenue and completed dossiers from active", () => {
  assert.deepEqual(calculateWorkProjectMetrics([
    { status: "planned", plannedRevenue: 100 },
    { status: "in_progress", plannedRevenue: 200 },
    { status: "on_hold", plannedRevenue: 300 },
    { status: "completed", plannedRevenue: 400 },
    { status: "cancelled", plannedRevenue: 500 },
    { status: "planned", plannedRevenue: 999, deletedAt: new Date() },
  ]), { active: 3, inProgress: 1, completed: 1, plannedRevenue: 1000 });
});
