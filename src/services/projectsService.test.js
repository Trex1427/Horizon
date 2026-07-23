import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeProjectPayload,
  normalizeProjectPayloadForCreate,
} from "./referencePayloadNormalizers.js";

test("project payload keeps optional activity/date/notes", () => {
  const payload = normalizeProjectPayload({
    name: "Chantier Monod",
    activityId: "act-auto",
    startDate: "2026-07-01",
    endDate: null,
    notes: "Lot 1",
  });

  assert.equal(payload.name, "Chantier Monod");
  assert.equal(payload.activityId, "act-auto");
  assert.equal(payload.startDate, "2026-07-01");
  assert.equal(payload.endDate, null);
  assert.equal(payload.notes, "Lot 1");
  assert.equal(payload.isActive, true);
});

test("project create payload sets createdAt", () => {
  const payload = normalizeProjectPayloadForCreate({
    name: "Garde Roy",
  });

  assert.equal(payload.activityId, null);
  assert.equal(typeof payload.createdAt, "string");
});
