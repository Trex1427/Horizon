import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeActivityPayload,
  normalizeActivityPayloadForCreate,
} from "./referencePayloadNormalizers.js";

test("activity payload enforces allowed kinds", () => {
  const payload = normalizeActivityPayload({
    name: "Pet sitting",
    kind: "profit_center",
  });

  assert.equal(payload.name, "Pet sitting");
  assert.equal(payload.kind, "profit_center");
  assert.equal(payload.isActive, true);
  assert.equal(typeof payload.updatedAt, "string");
});

test("activity create payload falls back to mixed on unknown kind", () => {
  const payload = normalizeActivityPayloadForCreate({
    name: "Animaux",
    kind: "unknown",
  });

  assert.equal(payload.kind, "mixed");
  assert.equal(typeof payload.createdAt, "string");
});
