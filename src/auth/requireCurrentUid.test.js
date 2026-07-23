import test from "node:test";
import assert from "node:assert/strict";
import {
  requireCurrentUid,
  sanitizeUserPayload,
  withOwnerUidForCreate,
} from "./requireCurrentUid.js";

test("requireCurrentUid returns the authenticated uid", () => {
  assert.equal(requireCurrentUid({ currentUser: { uid: "uid-real" } }), "uid-real");
});

test("requireCurrentUid refuses missing or empty users", () => {
  assert.throws(() => requireCurrentUid({ currentUser: null }), /Utilisateur Firebase requis/);
  assert.throws(() => requireCurrentUid({ currentUser: { uid: " " } }), /Utilisateur Firebase requis/);
});

test("sanitizeUserPayload removes protected user identity fields", () => {
  assert.deepEqual(sanitizeUserPayload({
    ownerUid: "fake",
    createdBy: "fake",
    uid: "fake",
    userId: "fake",
    ownerId: "fake",
    name: "Budget",
  }), { name: "Budget" });
});

test("sanitizeUserPayload can remove system fields for raw form payloads", () => {
  assert.deepEqual(sanitizeUserPayload({
    id: "doc",
    createdAt: "fake",
    updatedAt: "fake",
    name: "Budget",
  }, { removeSystemFields: true }), { name: "Budget" });
});

test("withOwnerUidForCreate ignores fake ownerUid and writes the current uid", () => {
  assert.deepEqual(withOwnerUidForCreate({
    ownerUid: "attacker",
    createdBy: "attacker",
    userId: "attacker",
    uid: "attacker",
    ownerId: "attacker",
    ownerUidNull: null,
    name: "Budget",
  }, { auth: { currentUser: { uid: "uid-real" } } }), {
    ownerUidNull: null,
    name: "Budget",
    ownerUid: "uid-real",
  });
});
