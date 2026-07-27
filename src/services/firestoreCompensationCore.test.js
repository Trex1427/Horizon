import test from "node:test";
import assert from "node:assert/strict";
import { commitFirestoreWithStorageCompensation } from "./firestoreCompensationCore.js";

test("successful Firestore batch returns success without cleanup", async () => {
  let cleanupCalls = 0;
  const result = await commitFirestoreWithStorageCompensation({
    commitFirestore: async () => {},
    storagePath: "users/u/documents/quotes/q/file.pdf",
    cleanupUploadedPdf: async () => { cleanupCalls += 1; },
    successValue: { id: "q" },
  });
  assert.deepEqual(result, { id: "q" });
  assert.equal(cleanupCalls, 0);
});

test("failed Firestore batch triggers successful compensation and preserves initial cause", async () => {
  const firestoreError = new Error("batch failed");
  const cleaned = [];
  await assert.rejects(
    () => commitFirestoreWithStorageCompensation({
      commitFirestore: async () => { throw firestoreError; },
      storagePath: "users/u/documents/quotes/q/file.pdf",
      cleanupUploadedPdf: async (path) => cleaned.push(path),
    }),
    (error) => {
      assert.equal(error.cause, firestoreError);
      assert.match(error.message, /Aucun devis n’a été créé/);
      return true;
    },
  );
  assert.deepEqual(cleaned, ["users/u/documents/quotes/q/file.pdf"]);
});

test("cleanup failure is logged without masking the Firestore error", async () => {
  const firestoreError = new Error("batch failed");
  const cleanupError = new Error("delete failed");
  const logs = [];
  await assert.rejects(
    () => commitFirestoreWithStorageCompensation({
      commitFirestore: async () => { throw firestoreError; },
      storagePath: "users/u/documents/quotes/q/file.pdf",
      cleanupUploadedPdf: async () => { throw cleanupError; },
      logger: { error: (...args) => logs.push(args) },
    }),
    (error) => error.cause === firestoreError,
  );
  assert.equal(logs.length, 1);
  assert.equal(logs[0][0], "quote_pdf_compensation:orphan_possible");
  assert.equal(logs[0][1].cleanupError, cleanupError);
  assert.equal(logs[0][1].storagePath, "users/u/documents/quotes/q/file.pdf");
});

test("batch failure without a newly uploaded file never calls cleanup", async () => {
  let cleanupCalls = 0;
  await assert.rejects(() => commitFirestoreWithStorageCompensation({
    commitFirestore: async () => { throw new Error("manual quote failed"); },
    storagePath: "",
    cleanupUploadedPdf: async () => { cleanupCalls += 1; },
  }));
  assert.equal(cleanupCalls, 0);
});
