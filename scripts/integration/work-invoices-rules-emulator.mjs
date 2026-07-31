import assert from "node:assert/strict";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const projectId = process.env.GCLOUD_PROJECT || "budget-alexandre";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST required");
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const owner = "invoice-owner";
const other = "invoice-other";
const now = new Date().toISOString();

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
const token = (uid) => `${encode({ alg: "none" })}.${encode({ aud: projectId, sub: uid, user_id: uid, iat: 1, exp: 4102444800, firebase: { sign_in_provider: "custom" } })}.`;

async function call(method, path, uid, body) {
  const response = await fetch(`${base}/${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(uid)}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

async function commit(uid, writes) {
  const response = await fetch(`${base}:commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(uid)}` },
    body: JSON.stringify({ writes }),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}
async function queryInvoices(uid, ownerUid) {
  const response = await fetch(`${base}:runQuery`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token(uid)}` },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: "workInvoices" }],
      where: { fieldFilter: { field: { fieldPath: "ownerUid" }, op: "EQUAL", value: { stringValue: ownerUid } } },
    } }),
  });
  return { ok: response.ok, status: response.status, body: await response.text() };
}

function invoiceFields({ ownerUid = owner, status = "pending_payment", thirdPartyId = null, workProjectId = null } = {}) {
  return { fields: {
    id: { stringValue: "invoice-1" }, ownerUid: { stringValue: ownerUid },
    invoiceNumber: { stringValue: "F-1" }, invoiceDate: { stringValue: "2026-07-01" }, dueDate: { stringValue: "" },
    thirdPartyId: thirdPartyId ? { stringValue: thirdPartyId } : { nullValue: null },
    workProjectId: workProjectId ? { stringValue: workProjectId } : { nullValue: null },
    amountHT: { doubleValue: 100 }, amountVAT: { doubleValue: 20 }, amountTTC: { doubleValue: 120 },
    status: { stringValue: status },
    pdfPath: { stringValue: `users/${ownerUid}/documents/invoices/invoice-1/a.pdf` },
    source: { stringValue: "tiiime" }, createdAt: { timestampValue: now }, updatedAt: { timestampValue: now },
  } };
}

if (!getApps().length) initializeApp({ projectId });
const adminDb = getFirestore();
await Promise.all([
  adminDb.doc("thirdParties/client-owner").set({ ownerUid: owner }),
  adminDb.doc("thirdParties/client-other").set({ ownerUid: other }),
  adminDb.doc("thirdParties/client-owner-two").set({ ownerUid: owner }),
  adminDb.doc("workProjects/project-owner").set({ ownerUid: owner, thirdPartyId: "client-owner" }),
  adminDb.doc("workProjects/project-other").set({ ownerUid: other, thirdPartyId: "client-other" }),
  adminDb.doc("workProjects/project-wrong-client").set({ ownerUid: owner, thirdPartyId: "client-owner-two" }),
]);

let result = await call("PATCH", "workInvoices/invoice-1", owner, invoiceFields());
assert.equal(result.ok, true, result.body);
result = await queryInvoices(owner, owner);
assert.equal(result.ok, true, `owner-scoped invoice query must be allowed: ${result.body}`);
result = await queryInvoices(other, owner);
assert.equal(result.status, 403, "another user must not query the owner's invoices");
result = await call("GET", "workInvoices/invoice-1", other);
assert.equal(result.status, 403);
result = await call("PATCH", "workInvoices/invoice-1", owner, invoiceFields({ ownerUid: other }));
assert.equal(result.status, 403);

const paid = invoiceFields({ status: "paid" });
paid.fields.updatedAt = { timestampValue: new Date(Date.now() + 1000).toISOString() };
result = await call("PATCH", "workInvoices/invoice-1", owner, paid);
assert.equal(result.ok, true, result.body);

result = await call("PATCH", "workInvoices/foreign-project", owner, {
  ...invoiceFields({ thirdPartyId: "client-other", workProjectId: "project-other" }),
  fields: { ...invoiceFields({ thirdPartyId: "client-other", workProjectId: "project-other" }).fields, id: { stringValue: "foreign-project" }, pdfPath: { stringValue: `users/${owner}/documents/invoices/foreign-project/a.pdf` } },
});
assert.equal(result.status, 403);

result = await call("PATCH", "workInvoices/wrong-client", owner, {
  ...invoiceFields({ thirdPartyId: "client-owner", workProjectId: "project-wrong-client" }),
  fields: { ...invoiceFields({ thirdPartyId: "client-owner", workProjectId: "project-wrong-client" }).fields, id: { stringValue: "wrong-client" }, pdfPath: { stringValue: `users/${owner}/documents/invoices/wrong-client/a.pdf` } },
});
assert.equal(result.status, 403);

const cancelled = invoiceFields({ status: "cancelled" });
result = await call("PATCH", "workInvoices/invoice-1", owner, cancelled);
assert.equal(result.status, 403);
const orphanCreatedAt = new Date(Date.now() - 5000);
await adminDb.doc("workInvoices/invoice-orphan-project").set({
  id: "invoice-orphan-project", ownerUid: owner, invoiceNumber: "F-ORPHAN", invoiceDate: "2026-07-01", dueDate: "",
  thirdPartyId: null, workProjectId: null, amountHT: 100, amountVAT: 20, amountTTC: 120,
  status: "pending_payment", pdfPath: `users/${owner}/documents/invoices/invoice-orphan-project/a.pdf`, source: "tiiime",
  createdAt: orphanCreatedAt, updatedAt: orphanCreatedAt,
});
const deletedAt = new Date().toISOString();
result = await call("PATCH", "workInvoices/invoice-orphan-project", owner, { fields: {
  id: { stringValue: "invoice-orphan-project" }, ownerUid: { stringValue: owner }, invoiceNumber: { stringValue: "F-ORPHAN" },
  invoiceDate: { stringValue: "2026-07-01" }, dueDate: { stringValue: "" }, thirdPartyId: { nullValue: null },
  workProjectId: { nullValue: null }, amountHT: { doubleValue: 100 }, amountVAT: { doubleValue: 20 }, amountTTC: { doubleValue: 120 },
  status: { stringValue: "pending_payment" }, pdfPath: { stringValue: `users/${owner}/documents/invoices/invoice-orphan-project/a.pdf` },
  source: { stringValue: "tiiime" }, createdAt: { timestampValue: orphanCreatedAt.toISOString() }, updatedAt: { timestampValue: deletedAt },
  isDeleted: { booleanValue: true }, deletedAt: { timestampValue: deletedAt }, deletedBy: { stringValue: owner },
} });
assert.equal(result.ok, true, `soft delete accepts a legacy invoice without an isDeleted field: ${result.body}`);
result = await queryInvoices(owner, owner);
assert.equal(result.ok, true, `owner listener query remains readable after soft delete: ${result.body}`);
const toggleCreatedAt = new Date(Date.now() - 10000);
const toggleUpdatedAt = new Date(Date.now() - 9000);
const toggleInvoice = {
  id: "invoice-toggle", ownerUid: owner, invoiceNumber: "F-TOGGLE", invoiceDate: "2026-07-01", dueDate: "",
  thirdPartyId: null, workProjectId: null, amountHT: 100, amountVAT: 20, amountTTC: 120,
  status: "paid", paymentTransactionId: "work-invoice-invoice-toggle",
  pdfPath: `users/${owner}/documents/invoices/invoice-toggle/a.pdf`, source: "tiiime",
  createdAt: toggleCreatedAt, updatedAt: toggleUpdatedAt,
};
const toggleTransaction = {
  ownerUid: owner, type: "revenu", montant: 120, accountId: "account-owner", destinationAccountId: null,
  thirdPartyId: null, workProjectId: null, workInvoiceId: "invoice-toggle", description: "Paiement facture F-TOGGLE",
  date: "2026-07-31", isDeleted: false, createdAt: toggleUpdatedAt, updatedAt: toggleUpdatedAt,
};
await Promise.all([
  adminDb.doc("workInvoices/invoice-toggle").set(toggleInvoice),
  adminDb.doc("transactions/work-invoice-invoice-toggle").set(toggleTransaction),
]);

const keptAt = new Date(Date.now() + 2000).toISOString();
result = await call("PATCH", "workInvoices/invoice-toggle?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt", owner, { fields: {
  status: { stringValue: "pending_payment" }, updatedAt: { timestampValue: keptAt },
} });
assert.equal(result.ok, true, `paid invoice can become pending while retaining its transaction: ${result.body}`);
let storedInvoice = (await adminDb.doc("workInvoices/invoice-toggle").get()).data();
let storedTransaction = (await adminDb.doc("transactions/work-invoice-invoice-toggle").get()).data();
assert.equal(storedInvoice.paymentTransactionId, "work-invoice-invoice-toggle");
assert.equal(storedTransaction.workInvoiceId, "invoice-toggle");
assert.equal(storedTransaction.isDeleted, false);

const repaidAt = new Date(Date.now() + 3000).toISOString();
result = await call("PATCH", "workInvoices/invoice-toggle?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt", owner, { fields: {
  status: { stringValue: "paid" }, updatedAt: { timestampValue: repaidAt },
} });
assert.equal(result.ok, true, `retained transaction can be reused without duplication: ${result.body}`);

const refusedAt = new Date(Date.now() + 4000).toISOString();
result = await call("PATCH", "workInvoices/invoice-toggle?updateMask.fieldPaths=status&updateMask.fieldPaths=paymentTransactionId&updateMask.fieldPaths=updatedAt", owner, { fields: {
  status: { stringValue: "pending_payment" }, updatedAt: { timestampValue: refusedAt },
} });
assert.equal(result.status, 403, "invoice link cannot be removed without atomically unlinking the transaction");

const removedAt = new Date(Date.now() + 5000).toISOString();
result = await commit(owner, [
  { update: { name: `projects/${projectId}/databases/(default)/documents/workInvoices/invoice-toggle`, fields: {
    status: { stringValue: "pending_payment" }, updatedAt: { timestampValue: removedAt },
  } }, updateMask: { fieldPaths: ["status", "paymentTransactionId", "updatedAt"] } },
  { update: { name: `projects/${projectId}/databases/(default)/documents/transactions/work-invoice-invoice-toggle`, fields: {
    isDeleted: { booleanValue: true }, deletedAt: { timestampValue: removedAt }, deletedBy: { stringValue: owner }, updatedAt: { timestampValue: removedAt },
  } }, updateMask: { fieldPaths: ["workInvoiceId", "isDeleted", "deletedAt", "deletedBy", "updatedAt"] } },
]);
assert.equal(result.ok, true, `invoice and linked transaction must be unlinked atomically: ${result.body}`);
storedInvoice = (await adminDb.doc("workInvoices/invoice-toggle").get()).data();
storedTransaction = (await adminDb.doc("transactions/work-invoice-invoice-toggle").get()).data();
assert.equal(storedInvoice.status, "pending_payment");
assert.equal("paymentTransactionId" in storedInvoice, false);
assert.equal(storedTransaction.isDeleted, true);
assert.equal("workInvoiceId" in storedTransaction, false);
const recreatedAt = new Date(Date.now() + 6000).toISOString();
result = await commit(owner, [
  { update: { name: `projects/${projectId}/databases/(default)/documents/transactions/work-invoice-invoice-toggle`, fields: {
    ownerUid: { stringValue: owner }, type: { stringValue: "revenu" }, montant: { doubleValue: 120 },
    accountId: { stringValue: "account-owner" }, destinationAccountId: { nullValue: null }, thirdPartyId: { nullValue: null },
    workProjectId: { nullValue: null }, workInvoiceId: { stringValue: "invoice-toggle" },
    description: { stringValue: "Paiement facture F-TOGGLE" }, date: { stringValue: "2026-07-31" },
    isDeleted: { booleanValue: false }, createdAt: { timestampValue: recreatedAt }, updatedAt: { timestampValue: recreatedAt },
  } } },
  { update: { name: `projects/${projectId}/databases/(default)/documents/workInvoices/invoice-toggle`, fields: {
    status: { stringValue: "paid" }, paymentTransactionId: { stringValue: "work-invoice-invoice-toggle" }, updatedAt: { timestampValue: recreatedAt },
  } }, updateMask: { fieldPaths: ["status", "paymentTransactionId", "updatedAt"] } },
]);
assert.equal(result.ok, true, `a deleted deterministic payment can be recreated atomically: ${result.body}`);
storedInvoice = (await adminDb.doc("workInvoices/invoice-toggle").get()).data();
storedTransaction = (await adminDb.doc("transactions/work-invoice-invoice-toggle").get()).data();
assert.equal(storedInvoice.status, "paid");
assert.equal(storedInvoice.paymentTransactionId, "work-invoice-invoice-toggle");
assert.equal(storedTransaction.isDeleted, false);
assert.equal(storedTransaction.workInvoiceId, "invoice-toggle");
console.log("workInvoices Firestore rules tests passed");
