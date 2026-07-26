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
  assert.equal(source.includes("deleteDoc"), false);
});
