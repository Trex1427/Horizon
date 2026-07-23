import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeThirdPartyPayload,
  normalizeThirdPartyPayloadForCreate,
} from "./referencePayloadNormalizers.js";

test("third-party payload supports notes and known type", () => {
  const payload = normalizeThirdPartyPayload({
    name: "EDF",
    type: "supplier",
    notes: "Contrat principal",
  });

  assert.equal(payload.name, "EDF");
  assert.equal(payload.type, "supplier");
  assert.equal(payload.notes, "Contrat principal");
  assert.equal(payload.isActive, true);
});

test("third-party create payload defaults unknown type to other", () => {
  const payload = normalizeThirdPartyPayloadForCreate({
    name: "Inconnu",
    type: "n/a",
  });

  assert.equal(payload.type, "other");
  assert.equal(typeof payload.createdAt, "string");
});
