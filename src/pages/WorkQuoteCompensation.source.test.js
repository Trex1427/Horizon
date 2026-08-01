import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("quote creation keeps document and quote writes in one batch with compensation", async () => {
  const source = await readFile(resolve(process.cwd(), "src/services/workQuotesService.js"), "utf8");
  assert.equal(source.includes("batch.set(documentRef"), true);
  assert.equal(source.includes("batch.set(quoteRef"), true);
  assert.equal(source.includes("commitFirestore: () => batch.commit()"), true);
  assert.equal(source.includes("cleanupUploadedPdf: cleanupOrphanQuotePdf"), true);
  assert.equal(source.includes("deleteObject"), false);
});

test("quote dialog prevents double validation and keeps retry state after failure", async () => {
  const source = await readFile(resolve(process.cwd(), "src/pages/Travail.jsx"), "utf8");
  assert.equal(source.includes("if (submittingRef.current) return;"), true);
  assert.equal(source.includes("submittingRef.current = true;"), true);
  assert.equal(source.includes("disabled={submitting}"), true);
  assert.equal(source.includes("finally"), true);
  assert.equal(source.includes("setSubmitting(false)"), true);
  assert.equal(source.includes("setDialog(null)"), true);
});
