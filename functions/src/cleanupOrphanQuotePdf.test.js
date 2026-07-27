import test from "node:test";
import assert from "node:assert/strict";
import { cleanupOrphanQuotePdfRequest, isOwnedQuoteStoragePath } from "./cleanupOrphanQuotePdf.js";

function responseRecorder() {
  return {
    statusCode: 0,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; },
    send(value) { this.body = value; },
  };
}

function request({ token = "valid", storagePath = "users/owner-a/documents/quotes/q1/d1-file.pdf" } = {}) {
  return {
    method: "POST",
    body: { storagePath },
    get: (name) => name === "authorization" && token ? `Bearer ${token}` : "",
  };
}

test("owned quote paths are accepted and arbitrary paths are rejected", () => {
  assert.equal(isOwnedQuoteStoragePath("users/owner-a/documents/quotes/q1/file.pdf", "owner-a"), true);
  assert.equal(isOwnedQuoteStoragePath("users/owner-b/documents/quotes/q1/file.pdf", "owner-a"), false);
  assert.equal(isOwnedQuoteStoragePath("users/owner-a/documents/other/file.pdf", "owner-a"), false);
  assert.equal(isOwnedQuoteStoragePath("users/owner-a/documents/quotes/../file.pdf", "owner-a"), false);
  assert.equal(isOwnedQuoteStoragePath("/users/owner-a/documents/quotes/q1/file.pdf", "owner-a"), false);
});

test("authenticated owner can delete only the explicitly supplied file", async () => {
  const deleted = [];
  const res = responseRecorder();
  await cleanupOrphanQuotePdfRequest(request(), res, {
    verifyIdToken: async () => ({ uid: "owner-a" }),
    deleteFile: async (path) => deleted.push(path),
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(deleted, ["users/owner-a/documents/quotes/q1/d1-file.pdf"]);
});

test("unauthenticated, foreign and arbitrary paths are refused without deletion", async () => {
  const cases = [
    [request({ token: "" }), {}, 401],
    [request({ storagePath: "users/owner-b/documents/quotes/q1/file.pdf" }), { verifyIdToken: async () => ({ uid: "owner-a" }) }, 403],
    [request({ storagePath: "unrelated/file.pdf" }), { verifyIdToken: async () => ({ uid: "owner-a" }) }, 403],
  ];
  for (const [req, config, status] of cases) {
    let deleted = false;
    const res = responseRecorder();
    await cleanupOrphanQuotePdfRequest(req, res, { ...config, deleteFile: async () => { deleted = true; } });
    assert.equal(res.statusCode, status);
    assert.equal(deleted, false);
  }
});

test("Storage deletion failure is explicit", async () => {
  const res = responseRecorder();
  await cleanupOrphanQuotePdfRequest(request(), res, {
    verifyIdToken: async () => ({ uid: "owner-a" }),
    deleteFile: async () => { throw new Error("storage down"); },
  });
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.error, "STORAGE_CLEANUP_FAILED");
});
