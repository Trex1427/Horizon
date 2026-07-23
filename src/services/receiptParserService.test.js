import test from "node:test";
import assert from "node:assert/strict";

import { requestReceiptDraft } from "./receiptParserService.js";

function createFetchResponse({ ok = true, status = 200, payload = {} } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test("requestReceiptDraft returns parsed draft on success", async () => {
  const result = await requestReceiptDraft({
    endpointUrl: "https://example.test/parseReceipt",
    payload: { imageBase64: "YWJj", mimeType: "image/png" },
    fetchImpl: async () => createFetchResponse({ ok: true, status: 200, payload: { description: "Ticket" } }),
  });

  assert.deepEqual(result, { description: "Ticket" });
});

test("requestReceiptDraft maps timeout errors", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      timeoutMs: 5,
      fetchImpl: (_url, options = {}) => new Promise((_, reject) => {
        options.signal?.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      }),
    }),
    /expire/i
  );
});

test("requestReceiptDraft maps HTTP 403", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      fetchImpl: async () => createFetchResponse({ ok: false, status: 403, payload: { error: "ORIGIN_NOT_ALLOWED" } }),
    }),
    /403/
  );
});

test("requestReceiptDraft maps HTTP 500+", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      fetchImpl: async () => createFetchResponse({ ok: false, status: 500, payload: { error: "RECEIPT_PARSING_FAILED" } }),
    }),
    /500/
  );
});

test("requestReceiptDraft maps network errors", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      fetchImpl: async () => {
        throw new TypeError("Failed to fetch");
      },
    }),
    /reseau/i
  );
});

test("requestReceiptDraft rejects invalid JSON response", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        async json() {
          throw new Error("invalid");
        },
      }),
    }),
    /json invalide/i
  );
});

test("requestReceiptDraft maps OpenAI quota unavailability", async () => {
  await assert.rejects(
    () => requestReceiptDraft({
      endpointUrl: "https://example.test/parseReceipt",
      payload: { imageBase64: "YWJj", mimeType: "image/png" },
      fetchImpl: async () => createFetchResponse({ ok: false, status: 503, payload: { error: "OPENAI_QUOTA_UNAVAILABLE" } }),
    }),
    /quota|credit|openai/i
  );
});
