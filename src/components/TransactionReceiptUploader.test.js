import test from "node:test";
import assert from "node:assert/strict";

import { processReceiptUpload, runReceiptUploadLifecycle } from "./transactionReceiptUploadLogic.js";

test("processReceiptUpload calls onDraftReady on success", async () => {
  const calls = [];

  await processReceiptUpload({
    file: { name: "ticket.png" },
    availableCategories: [{ id: "cat-1", name: "Alimentation" }],
    parseReceipt: async () => ({ draft: { description: "Ticket" } }),
    onDraftReady: (parsed) => calls.push(["draft", parsed]),
    onError: (message) => calls.push(["error", message]),
    setUploaderError: (message) => calls.push(["setError", message]),
  });

  assert.deepEqual(calls[0], ["setError", ""]);
  assert.deepEqual(calls[1], ["draft", { draft: { description: "Ticket" } }]);
});

test("runReceiptUploadLifecycle always resets loading in finally", async () => {
  const parsingStates = [];

  await runReceiptUploadLifecycle({
    file: { name: "ticket.png" },
    parseReceipt: async () => {
      throw new Error("Erreur 500: service scanner indisponible.");
    },
    onDraftReady: () => {},
    onError: () => {},
    setUploaderError: () => {},
    setIsParsing: (value) => parsingStates.push(value),
  });

  assert.deepEqual(parsingStates, [true, false]);
});

test("runReceiptUploadLifecycle supports retry after error", async () => {
  let attempts = 0;
  const parsingStates = [];
  const draftCalls = [];

  const parseReceipt = async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("Erreur reseau: impossible de joindre le scanner ticket.");
    }

    return { draft: { description: "retry-success" } };
  };

  await runReceiptUploadLifecycle({
    file: { name: "ticket.png" },
    parseReceipt,
    onDraftReady: (payload) => draftCalls.push(payload),
    onError: () => {},
    setUploaderError: () => {},
    setIsParsing: (value) => parsingStates.push(value),
  });

  await runReceiptUploadLifecycle({
    file: { name: "ticket.png" },
    parseReceipt,
    onDraftReady: (payload) => draftCalls.push(payload),
    onError: () => {},
    setUploaderError: () => {},
    setIsParsing: (value) => parsingStates.push(value),
  });

  assert.equal(attempts, 2);
  assert.equal(draftCalls.length, 1);
  assert.deepEqual(draftCalls[0], { draft: { description: "retry-success" } });
  assert.deepEqual(parsingStates, [true, false, true, false]);
});
