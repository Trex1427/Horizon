/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("quote cards open the prefilled editor on double click without changing project linkage", async () => {
  const [page, service] = await Promise.all([read("src/pages/Travail.jsx"), read("src/services/workQuotesService.js")]);
  assert.match(page, /onDoubleClick=\{\(\) => \{ setPdfFile\(null\); setExtraction\(null\); setDialog\(\{ \.\.\.quote \}\); \}\}/);
  assert.match(page, /quote=\{dialog \|\| EMPTY_QUOTE\}/);
  assert.match(service, /updateDoc\(doc\(db, QUOTES, id\), normalizeQuote\(payload\)\)/);
  assert.doesNotMatch(service, /updateWorkQuote[\s\S]*projectId\s*:/);
});

test("quote form creates and selects a professional activity without replacing its draft", async () => {
  const page = await read("src/pages/Travail.jsx");
  assert.match(page, /\+ Nouvelle activit/);
  assert.match(page, /addProfessionalActivity\(quickActivity\)/);
  assert.match(page, /setForm\(\(current\) => \(\{ \.\.\.current, professionalActivityId: result\.value\.id \}\)\)/);
  assert.match(page, /Le nom de l['’]activit/);
});

test("invoice payment does not read the nonexistent deterministic transaction and guards repeated submits", async () => {
  const [view, service] = await Promise.all([read("src/features/work/WorkInvoicesViews.jsx"), read("src/services/workInvoicesService.js")]);
  const paymentCreation = service.slice(service.indexOf("export async function markWorkInvoicePaidWithTransaction"));
  assert.doesNotMatch(paymentCreation, /transaction\.get\(transactionRef\)/);
  assert.match(service, /if \(invoice\.paymentTransactionId\)/);
  assert.match(service, /if \(invoice\.status !== "pending_payment"\)/);
  assert.match(service, /transaction\.set\(transactionRef/);
  assert.match(service, /workInvoiceId: invoiceId/);
  assert.match(service, /paymentTransactionId: transactionRef\.id/);
  assert.match(view, /paymentGuard\.current/);
  assert.match(view, /lectionnez un compte/);
  assert.match(view, /paymentError && <Alert severity="error">/);
});
test("paid invoices can return to pending with an atomic linked-payment choice", async () => {
  const [view, service, rules] = await Promise.all([read("src/features/work/WorkInvoicesViews.jsx"), read("src/services/workInvoicesService.js"), read("firestore.rules")]);
  assert.match(view, /Cette facture est li/);
  assert.match(view, /Conserver la transaction/);
  assert.match(view, /supprimer la transaction/);
  assert.match(view, /paymentGuard\.current/);
  assert.match(service, /markWorkInvoicePending/);
  assert.match(service, /workInvoiceId: deleteField\(\)/);
  assert.match(service, /paymentTransactionId: deleteField\(\)/);
  assert.match(service, /transaction\.update\(transactionRef/);
  assert.match(rules, /isWorkInvoicePaymentRemoval/);
  assert.match(rules, /resource\.data\.status == "paid" && request\.resource\.data\.status == "pending_payment"/);
});
