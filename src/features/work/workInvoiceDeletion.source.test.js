import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("linked invoice deletion exposes exactly the three requested decisions", async () => {
  const view = await read("src/features/work/WorkInvoicesViews.jsx");
  const start = view.indexOf("<Dialog open={Boolean(deletionInvoice)}");
  const end = view.indexOf("<Dialog open={Boolean(paymentInvoice)}", start);
  const dialog = view.slice(start, end);
  assert.match(dialog, />Annuler</);
  assert.match(dialog, />Supprimer uniquement la facture</);
  assert.match(dialog, />Supprimer la facture et la transaction</);
  assert.equal((dialog.match(/<Button/g) || []).length, 3);
});

test("invoice deletion is atomic, owner-scoped and never physically deletes", async () => {
  const [service, rules] = await Promise.all([read("src/services/workInvoicesService.js"), read("firestore.rules")]);
  const deletion = service.slice(service.indexOf("export async function softDeleteWorkInvoice"), service.indexOf("export function openWorkInvoicePdf"));
  assert.match(deletion, /runTransaction/);
  assert.match(deletion, /ownerUid !== ownerUid/);
  assert.match(deletion, /paymentTransactionId: deleteField\(\)/);
  assert.match(deletion, /workInvoiceId: deleteField\(\)/);
  assert.match(deletion, /isDeleted: true/);
  assert.doesNotMatch(deletion, /deleteDoc|transaction\.delete/);
  assert.match(rules, /isWorkInvoiceDeletionCleanup/);
  assert.match(rules, /match \/workInvoices[\s\S]*allow delete: if false/);
});

test("historical candidates include deterministic and inverse-only links without recreation", async () => {
  const service = await read("src/services/workInvoicesService.js");
  assert.match(service, /entry\.workInvoiceId === invoiceId \|\| entry\.id === `work-invoice-\$\{invoiceId\}`/);
  assert.match(service, /if \(invoice\.paymentTransactionId\) candidateIds\.add/);
  assert.match(service, /snapshot\.exists\(\) && snapshot\.data\(\)\.ownerUid === ownerUid/);
  const deletion = service.slice(service.indexOf("export async function softDeleteWorkInvoice"));
  assert.doesNotMatch(deletion, /transaction\.set/);
});

test("paid-to-pending workflow keeps its two existing linked-payment options", async () => {
  const [service, view] = await Promise.all([read("src/services/workInvoicesService.js"), read("src/features/work/WorkInvoicesViews.jsx")]);
  const pending = service.slice(service.indexOf("export async function markWorkInvoicePending"), service.indexOf("export async function markWorkInvoicePaidWithTransaction"));
  assert.match(pending, /deleteLinkedTransaction = false/);
  assert.match(pending, /transactionKept: true/);
  assert.match(pending, /transactionDeleted: true/);
  assert.match(view, /Conserver la transaction/);
  assert.match(view, /Repasser non payée et supprimer la transaction/);
});
