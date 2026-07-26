import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const servicePath = resolve(process.cwd(), "src/services/debtsReceivablesService.js");

test("service filters reads by ownerUid and active tombstones", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /where\("ownerUid", "==", ownerUid\)/);
  assert.match(source, /where\("isDeleted", "==", false\)/);
  assert.match(source, /filter\(\(item\) => item\.isDeleted !== true\)/);
});

test("receivable CRUD atomically maintains exactly one initial expense transaction", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /runTransaction\(db/);
  assert.match(source, /initialTransactionId: initialTransactionRef\?\.id \|\| null/);
  assert.match(source, /type: "depense"/);
  assert.match(source, /montant: normalized\.amount/);
  assert.match(source, /date: normalized\.initialDate/);
  assert.match(source, /accountId: normalized\.initialAccountId/);
  assert.match(source, /categoryId: category\.id/);
  assert.match(source, /thirdPartyId: thirdParty\.id/);
  assert.match(source, /debtReceivableInitial: true/);
  assert.match(source, /existingInitialId \? doc\(db, TRANSACTIONS_COLLECTION, existingInitialId\) : fallbackTransactionRef/);
  assert.match(source, /transaction\.update\(initialTransactionRef, initialPayload\)/);
  assert.match(source, /transaction\.set\(initialTransactionRef, \{ \.\.\.initialPayload, createdAt: serverTimestamp\(\) \}\)/);
  assert.match(source, /if \(initialSnapshot\?\.exists\(\)\) transaction\.update\(initialRef, \{ isDeleted: true/);
});

test("debt keeps payment expenses but creates no automatic initial banking transaction", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /normalized\.type === "receivable" \? doc\(collection\(db, TRANSACTIONS_COLLECTION\)\) : null/);
  assert.match(source, /const paymentType = normalized\.type === "receivable" \? "revenu" : "depense"/);
});

test("legacy receivable without an initial link is repaired once on explicit update", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /String\(parentData\.initialTransactionId \|\| ""\)/);
  assert.match(source, /fallbackTransactionRef/);
  assert.match(source, /initialTransactionId: shouldHaveInitial \? initialTransactionRef\.id : null/);
});