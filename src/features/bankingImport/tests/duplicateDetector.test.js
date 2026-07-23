import test from "node:test";
import assert from "node:assert/strict";
import { detectImportedDuplicates } from "../detectors/duplicateDetector.js";

test("detectImportedDuplicates marks exact duplicate by bankReference", () => {
  const rows = [
    { sourceRowIndex: 2, accountId: "acc-1", bankReference: "REF1", fingerprint: "fp-1", operationDate: "2026-01-05", amount: -10, normalizedLabel: "CB TEST", rawLabel: "CB TEST" },
    { sourceRowIndex: 3, accountId: "acc-1", bankReference: "REF1", fingerprint: "fp-2", operationDate: "2026-01-05", amount: -10, normalizedLabel: "CB TEST", rawLabel: "CB TEST" },
  ];

  const result = detectImportedDuplicates(rows, []);
  assert.equal(result[0].duplicateStatus, "exact_duplicate");
  assert.equal(result[1].duplicateStatus, "exact_duplicate");
});

test("detectImportedDuplicates marks exact duplicate by fingerprint against existing transaction", () => {
  const rows = [
    { sourceRowIndex: 2, accountId: "acc-1", bankReference: "", fingerprint: "fp-1", operationDate: "2026-01-05", amount: -10, normalizedLabel: "CB TEST", rawLabel: "CB TEST" },
  ];
  const existing = [
    { id: "tx-1", accountId: "acc-1", importFingerprint: "fp-1", type: "depense", montant: 10, date: "2026-01-05", description: "CB TEST" },
  ];

  const result = detectImportedDuplicates(rows, existing);
  assert.equal(result[0].duplicateStatus, "exact_duplicate");
});

test("detectImportedDuplicates marks probable duplicate", () => {
  const rows = [
    { sourceRowIndex: 2, accountId: "acc-1", bankReference: "", fingerprint: "fp-1", operationDate: "2026-01-05", amount: -10, normalizedLabel: "CARREFOUR VITROLLES", rawLabel: "CARREFOUR VITROLLES" },
  ];
  const existing = [
    { id: "tx-1", accountId: "acc-1", type: "depense", montant: 10, date: "2026-01-06", description: "CARREFOUR" },
  ];

  const result = detectImportedDuplicates(rows, existing);
  assert.equal(result[0].duplicateStatus, "probable_duplicate");
});