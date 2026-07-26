import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const servicePath = resolve(process.cwd(), "src/services/debtReceivablePaymentsService.js");

test("payment service uses atomic runTransaction parent+payment writes", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /runTransaction\(db/);
  assert.match(source, /paymentsRevision/);
  assert.match(source, /paymentsMutationId/);
  assert.match(source, /serverTimestamp\(\)/);
  assert.match(source, /where\("isDeleted", "==", false\)/);
});

test("payment service enforces overpayment checks and logical deletion", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /depasse le montant initial/);
  assert.match(source, /isDeleted: true/);
  assert.match(source, /deletedAt: serverTimestamp\(\)/);
  assert.match(source, /MAX_PAYMENT_MUTATION_RETRIES/);
  assert.match(source, /transactionRef && transactionExists/);
  assert.match(source, /transaction\.update\(parentRef, buildParentPaymentMutation/);
  assert.equal(source.includes("deleteDoc"), false);
});
test("payment service atomically maintains one linked banking transaction", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /TRANSACTIONS_COLLECTION/);
  assert.match(source, /debtReceivablePaymentId/);
  assert.match(source, /transactionId: transactionRef\.id/);
  assert.match(source, /parentData\.type === "receivable" \? "revenu" : "depense"/);
  assert.match(source, /readOwnedActiveAccount/);
  assert.match(source, /thirdPartyId: thirdParty\.id/);
  assert.match(source, /thirdPartyName: thirdParty\.name/);
  assert.match(source, /categoryId: category\.id/);
  assert.match(source, /categoryName: category\.name/);
  assert.match(source, /categorie: category\.name/);
  assert.match(source, /readOwnedReference\(transaction, THIRD_PARTIES_COLLECTION/);
  assert.match(source, /readOwnedReference\(transaction, CATEGORIES_COLLECTION/);
  assert.match(source, /transaction\.update\(transactionRef, linkedTransaction\)/);
  assert.match(source, /deletedAt: serverTimestamp\(\)/);
});
test("payment totals use a query outside the Firestore transaction and revision locking", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /getDocs\(activePaymentsQuery\)/);
  assert.match(source, /readPaymentMutationBaseline/);
  assert.match(source, /assertUnchangedPaymentBaseline/);
  assert.equal(source.includes("transaction.get(activePaymentsQuery)"), false);
});
