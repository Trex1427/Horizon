import test from "node:test";
import assert from "node:assert/strict";
import { normalizeImportedTransaction } from "../normalizers/normalizeImportedTransaction.js";

test("normalizeImportedTransaction keeps depense/revenu typing even when label contains virement", () => {
  const row = normalizeImportedTransaction({
    operationDate: "11/07/2026",
    valueDate: "11/07/2026",
    rawLabel: "VIREMENT CLIENT DUPONT",
    credit: "1200,00",
  }, {
    accountId: "acc-1",
  });

  assert.equal(row.type, "revenu");
  assert.equal(row.transferCandidate, false);
  assert.equal(row.transferConfirmed, false);
});

test("normalizeImportedTransaction flags internal virement as transfer candidate without auto confirmation", () => {
  const row = normalizeImportedTransaction({
    operationDate: "11/07/2026",
    valueDate: "11/07/2026",
    rawLabel: "VIREMENT INTERNE VERS LIVRET A",
    debit: "500,00",
  }, {
    accountId: "acc-1",
  });

  assert.equal(row.type, "depense");
  assert.equal(row.transferCandidate, true);
  assert.equal(row.transferConfidence > 0, true);
  assert.equal(Array.isArray(row.transferReasons), true);
  assert.equal(row.transferConfirmed, false);
});
