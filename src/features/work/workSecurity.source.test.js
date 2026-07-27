/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("Firestore rules isolate all Work collections by ownerUid", async () => {
  const rules = await readFile(resolve(process.cwd(), "firestore.rules"), "utf8");
  for (const collection of ["professionalActivities", "workQuotes", "workProjects", "documents"]) {
    assert.equal(rules.includes(`match /${collection}/{documentId}`), true, collection);
  }
  assert.equal(rules.includes("allow get, list: if readsOwnDocument();"), true);
});

test("Storage rules isolate owner paths and reject non-PDF or oversized writes", async () => {
  const rules = await readFile(resolve(process.cwd(), "storage.rules"), "utf8");
  assert.equal(rules.includes("match /users/{ownerUid}/documents/{allPaths=**}"), true);
  assert.equal(rules.includes("request.auth.uid == ownerUid"), true);
  assert.equal(rules.includes('request.resource.contentType == "application/pdf"'), true);
  assert.equal(rules.includes("request.resource.size <= 10 * 1024 * 1024"), true);
  assert.equal(rules.includes("allow update, delete: if false;"), true);
});
