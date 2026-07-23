import test from "node:test";
import assert from "node:assert/strict";

import { parseReceiptWithVision } from "./parseReceipt.js";

function createRequest({ method = "POST", origin = "https://budget-alexandre.web.app", body = {} } = {}) {
  return {
    method,
    body,
    get(name) {
      if (String(name).toLowerCase() === "origin") {
        return origin;
      }
      return "";
    },
  };
}

function createResponse() {
  const headers = new Map();
  let currentStatus = 200;
  let jsonPayload = null;
  let sentPayload = null;

  const res = {
    set(name, value) {
      headers.set(name, value);
      return res;
    },
    status(code) {
      currentStatus = code;
      return res;
    },
    json(payload) {
      jsonPayload = payload;
      return res;
    },
    send(payload) {
      sentPayload = payload;
      return res;
    },
  };

  return {
    res,
    read() {
      return {
        status: currentStatus,
        json: jsonPayload,
        sent: sentPayload,
        headers,
      };
    },
  };
}

const BASE_CONFIG = {
  openAiApiKey: "test-key",
  openAiModel: "gpt-4.1-mini",
  maxImageBytes: 8 * 1024 * 1024,
  allowedOrigins: [
    "http://localhost:5173",
    "https://budget-alexandre.web.app",
    "https://budget-alexandre.firebaseapp.com",
  ],
};

test("parseReceiptWithVision handles OPTIONS preflight for allowed origin", async () => {
  const req = createRequest({ method: "OPTIONS" });
  const { res, read } = createResponse();

  await parseReceiptWithVision(req, res, BASE_CONFIG);

  const snapshot = read();
  assert.equal(snapshot.status, 204);
  assert.equal(snapshot.headers.get("Access-Control-Allow-Methods"), "POST, OPTIONS");
  assert.equal(snapshot.headers.get("Access-Control-Allow-Origin"), "https://budget-alexandre.web.app");
});

test("parseReceiptWithVision rejects non allowed origins", async () => {
  const req = createRequest({
    method: "POST",
    origin: "https://forbidden.example",
    body: { imageBase64: "abc", mimeType: "image/png" },
  });
  const { res, read } = createResponse();

  await parseReceiptWithVision(req, res, BASE_CONFIG);

  const snapshot = read();
  assert.equal(snapshot.status, 403);
  assert.deepEqual(snapshot.json, { error: "ORIGIN_NOT_ALLOWED" });
});

test("parseReceiptWithVision returns 400 for invalid body and exposes explicit message", async () => {
  const req = createRequest({ method: "POST", body: { mimeType: "image/png" } });
  const { res, read } = createResponse();

  await parseReceiptWithVision(req, res, BASE_CONFIG);

  const snapshot = read();
  assert.equal(snapshot.status, 400);
  assert.deepEqual(snapshot.json, { error: "IMAGE_BASE64_REQUIRED" });
});

test("parseReceiptWithVision returns 405 for unsupported methods", async () => {
  const req = createRequest({ method: "GET" });
  const { res, read } = createResponse();

  await parseReceiptWithVision(req, res, BASE_CONFIG);

  const snapshot = read();
  assert.equal(snapshot.status, 405);
  assert.deepEqual(snapshot.json, { error: "METHOD_NOT_ALLOWED" });
  assert.equal(snapshot.headers.get("Allow"), "POST");
});
