import test from "node:test";
import assert from "node:assert/strict";
import { buildDefaultCategoryDocuments } from "./categoriesDefaults.js";

const OWNER_UID = "owner-user-123";
const FIXED_NOW = () => "2026-01-01T00:00:00.000Z";

test("default category seed plans exactly twelve categories for an empty owner", () => {
  const documents = buildDefaultCategoryDocuments({ ownerUid: OWNER_UID, existingCategories: [], now: FIXED_NOW });

  assert.equal(documents.length, 12);
  assert.equal(new Set(documents.map((document) => document.id)).size, 12);
  assert.equal(documents.every((document) => document.id.startsWith(`${OWNER_UID}_default-category-`)), true);
});

test("default category seed is idempotent on a second pass", () => {
  const firstPass = buildDefaultCategoryDocuments({ ownerUid: OWNER_UID, existingCategories: [], now: FIXED_NOW });
  const existingCategories = firstPass.map((document) => ({ id: document.id, ...document.data }));
  const secondPass = buildDefaultCategoryDocuments({ ownerUid: OWNER_UID, existingCategories, now: FIXED_NOW });

  assert.equal(secondPass.length, 0);
  assert.equal(existingCategories.length, 12);
});
