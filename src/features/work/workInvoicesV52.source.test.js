/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("invoice payment is atomic, linked and protected against duplicates", async () => {
  const [service, rules] = await Promise.all([read("src/services/workInvoicesService.js"), read("firestore.rules")]);
  assert.match(service, /runTransaction/);
  assert.match(service, /work-invoice-\$\{invoiceId\}/);
  const paymentCreation = service.slice(service.indexOf("export async function markWorkInvoicePaidWithTransaction"));
  assert.doesNotMatch(paymentCreation, /transaction\.get\(transactionRef\)/);
  assert.match(service, /workInvoiceId: invoiceId/);
  assert.match(service, /paymentTransactionId: transactionRef\.id/);
  assert.match(rules, /isWorkInvoicePaymentTransaction/);
  assert.match(rules, /existsAfter\(\/databases\/\$\(database\)\/documents\/transactions/);
});

test("invoice and quote soft deletes keep storage and linked records", async () => {
  const [invoiceService, quoteService, invoiceView] = await Promise.all([read("src/services/workInvoicesService.js"), read("src/services/workQuotesService.js"), read("src/features/work/WorkInvoicesViews.jsx")]);
  assert.match(invoiceService, /isDeleted: true/);
  assert.match(invoiceService, /deletedBy: ownerUid/);
  assert.doesNotMatch(invoiceService, /deleteObject/);
  assert.match(quoteService, /softDeleteWorkQuote/);
  assert.doesNotMatch(quoteService, /deleteDoc/);
  assert.match(invoiceView, /Elle sera conservée/);
});

test("payment dialog exposes all three choices and requires an account", async () => {
  const view = await read("src/features/work/WorkInvoicesViews.jsx");
  assert.match(view, /Créer la transaction/);
  assert.match(view, /Marquer payée sans transaction/);
  assert.match(view, />Annuler</);
  assert.match(view, /label="Compte"/);
});