import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeSubcategoryPayloadForCreate,
  normalizeSubcategoryPayloadForUpdate,
} from "./referencePayloadNormalizers.js";

test("subcategory create payload enforces category linkage and type", () => {
  const payload = normalizeSubcategoryPayloadForCreate({
    name: "  Carburant  ",
    categoryId: "cat-transport",
    type: "depense",
  });

  assert.equal(payload.name, "Carburant");
  assert.equal(payload.categoryId, "cat-transport");
  assert.equal(payload.type, "depense");
  assert.equal(payload.isActive, true);
  assert.equal(typeof payload.createdAt, "string");
  assert.equal(typeof payload.updatedAt, "string");
});

test("subcategory update payload keeps valid revenu type", () => {
  const payload = normalizeSubcategoryPayloadForUpdate({
    name: "Prestation",
    categoryId: "cat-pro-revenue",
    type: "revenu",
    isActive: false,
  });

  assert.equal(payload.name, "Prestation");
  assert.equal(payload.categoryId, "cat-pro-revenue");
  assert.equal(payload.type, "revenu");
  assert.equal(payload.isActive, false);
  assert.equal(typeof payload.updatedAt, "string");
});
