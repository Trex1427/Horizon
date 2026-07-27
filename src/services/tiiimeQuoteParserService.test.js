import test from "node:test";
import assert from "node:assert/strict";
import { requestTiiimeQuoteExtraction } from "./tiiimeQuoteRequest.js";

test("authenticated parser request returns structured fields without creating a quote", async () => {
  let request;
  const result = await requestTiiimeQuoteExtraction({
    url: "https://example.test/parse",
    token: "firebase-token",
    pdfBase64: "JVBERg==",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ quoteNumber: "Q1", issueDate: "2026-07-27", amount: 0, customerName: "Martin" }) };
    },
  });
  assert.equal(request.options.headers.Authorization, "Bearer firebase-token");
  assert.deepEqual(result, { quoteNumber: "Q1", issueDate: "2026-07-27", amount: "0", customerName: "Martin" });
});

test("parser exposes parsing errors and invalid responses", async () => {
  await assert.rejects(() => requestTiiimeQuoteExtraction({
    url: "x", token: "t", pdfBase64: "x",
    fetchImpl: async () => ({ ok: false, json: async () => ({ error: "QUOTE_PARSING_FAILED" }) }),
  }), /QUOTE_PARSING_FAILED/);
  await assert.rejects(() => requestTiiimeQuoteExtraction({
    url: "x", token: "t", pdfBase64: "x",
    fetchImpl: async () => ({ ok: true, json: async () => null }),
  }), /serveur/);
});
