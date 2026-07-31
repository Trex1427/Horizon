import test from "node:test";
import assert from "node:assert/strict";
import { planWorkInvoiceDeletion } from "./workInvoiceDeletionModel.js";

test("deletion without a linked transaction only soft-deletes the invoice", () => {
  const plan = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: {}, transactions: [] });
  assert.deepEqual(plan.linkedTransactions, []);
  assert.equal(plan.invoicePatch.softDelete, true);
});

test("invoice and payment deletion removes both links and the ghost revenue", () => {
  const plan = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: { paymentTransactionId: "t1" }, transactions: [{ id: "t1", workInvoiceId: "i1", isDeleted: false }], deleteLinkedTransaction: true });
  assert.deepEqual(plan.linkedTransactions, [{ id: "t1", removeInvoiceLink: true, softDelete: true, alreadyDeleted: false }]);
  assert.equal(plan.transactionDeleted, true);
  assert.equal(plan.transactionKept, false);
});

test("invoice-only deletion keeps an independent active revenue", () => {
  const plan = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: { paymentTransactionId: "t1" }, transactions: [{ id: "t1", workInvoiceId: "i1" }] });
  assert.equal(plan.linkedTransactions[0].removeInvoiceLink, true);
  assert.equal(plan.linkedTransactions[0].softDelete, false);
  assert.equal(plan.transactionKept, true);
});

test("historical one-sided links are cleaned in either direction", () => {
  const invoiceOnly = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: { paymentTransactionId: "t1" }, transactions: [{ id: "t1" }] });
  const transactionOnly = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: {}, transactions: [{ id: "t1", workInvoiceId: "i1" }] });
  assert.equal(invoiceOnly.linkedTransactions.length, 1);
  assert.equal(invoiceOnly.linkedTransactions[0].removeInvoiceLink, false);
  assert.equal(transactionOnly.linkedTransactions[0].removeInvoiceLink, true);
});

test("missing or already deleted payments never block invoice deletion", () => {
  assert.equal(planWorkInvoiceDeletion({ invoiceId: "i1", invoice: { paymentTransactionId: "missing" }, transactions: [] }).linkedTransactions.length, 0);
  const deleted = planWorkInvoiceDeletion({ invoiceId: "i1", invoice: { paymentTransactionId: "t1" }, transactions: [{ id: "t1", workInvoiceId: "i1", isDeleted: true }], deleteLinkedTransaction: true });
  assert.equal(deleted.linkedTransactions[0].softDelete, false);
  assert.equal(deleted.linkedTransactions[0].removeInvoiceLink, true);
});
