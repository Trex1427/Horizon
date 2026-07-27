import test from "node:test";
import assert from "node:assert/strict";
import { parseTiiimeQuoteRequest } from "./parseTiiimeQuote.js";

function responseRecorder() {
  return { statusCode: 0, body: null, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; }, send(value) { this.body = value; } };
}
function request(overrides = {}) {
  return { method: "POST", body: { mimeType: "application/pdf", pdfBase64: "JVBERi0x" }, get: (name) => name === "authorization" ? "Bearer valid" : "", ...overrides };
}
const extractionResponse = { output_text: JSON.stringify({ quoteNumber: "D-12", issueDate: "2026-07-27", amount: 120, customerName: "Dupont" }) };

test("authenticated PDF is analyzed and normalized", async () => {
  const res = responseRecorder();
  await parseTiiimeQuoteRequest(request(), res, { openAiApiKey: "test", verifyIdToken: async () => ({ uid: "owner" }), openAiClient: { responses: { create: async () => extractionResponse } } });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { quoteNumber: "D-12", issueDate: "2026-07-27", amount: 120, customerName: "Dupont" });
});

test("missing fields remain empty and no write is performed", async () => {
  const res = responseRecorder();
  await parseTiiimeQuoteRequest(request(), res, { openAiApiKey: "test", verifyIdToken: async () => ({ uid: "owner" }), openAiClient: { responses: { create: async () => ({ output_text: '{"quoteNumber":null,"issueDate":null,"amount":null,"customerName":null}' }) } } });
  assert.deepEqual(res.body, { quoteNumber: "", issueDate: "", amount: null, customerName: "" });
});

test("invalid auth, mime, size, parsing and server response are rejected", async () => {
  for (const [req, config, status] of [
    [request({ get: () => "" }), {}, 401],
    [request({ body: { mimeType: "image/png", pdfBase64: "abc" } }), { verifyIdToken: async () => ({}) }, 400],
    [request({ body: { mimeType: "application/pdf", pdfBase64: "abcdefgh" } }), { verifyIdToken: async () => ({}), maxPdfBytes: 1 }, 413],
    [request(), { openAiApiKey: "test", verifyIdToken: async () => ({}), openAiClient: { responses: { create: async () => ({ output_text: "bad" }) } } }, 500],
  ]) {
    const res = responseRecorder();
    await parseTiiimeQuoteRequest(req, res, config);
    assert.equal(res.statusCode, status);
  }
});
