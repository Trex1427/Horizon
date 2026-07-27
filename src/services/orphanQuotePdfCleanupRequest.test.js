import test from "node:test";
import assert from "node:assert/strict";
import { requestOrphanQuotePdfCleanup } from "./orphanQuotePdfCleanupRequest.js";

test("cleanup request sends Firebase token and exact path", async () => {
  let captured;
  const result = await requestOrphanQuotePdfCleanup({
    endpointUrl: "https://example.test/cleanup",
    token: "firebase-token",
    storagePath: "users/u/documents/quotes/q/file.pdf",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, json: async () => ({ deleted: true, storagePath: "users/u/documents/quotes/q/file.pdf" }) };
    },
  });
  assert.equal(captured.options.headers.Authorization, "Bearer firebase-token");
  assert.deepEqual(JSON.parse(captured.options.body), { storagePath: "users/u/documents/quotes/q/file.pdf" });
  assert.equal(result.deleted, true);
});

test("cleanup request rejects server and invalid responses", async () => {
  await assert.rejects(() => requestOrphanQuotePdfCleanup({
    endpointUrl: "x", token: "t", storagePath: "p",
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: "STORAGE_PATH_FORBIDDEN" }) }),
  }), /STORAGE_PATH_FORBIDDEN/);
  await assert.rejects(() => requestOrphanQuotePdfCleanup({
    endpointUrl: "x", token: "t", storagePath: "p",
    fetchImpl: async () => ({ ok: true, json: async () => { throw new Error("invalid"); } }),
  }), /Réponse invalide/);
});
