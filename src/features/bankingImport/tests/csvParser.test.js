import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeCsvContent, parseCsvContent } from "../parsers/csvParser.js";

const fixturesDir = resolve(process.cwd(), "src/features/bankingImport/tests/fixtures");

test("analyzeCsvContent detects french semicolon mapping", () => {
  const csv = [
    "Date operation;Date valeur;Libelle;Debit;Credit;Reference",
    "05/01/2026;06/01/2026;CB CARREFOUR VITROLLES;82,43;;ABC123",
  ].join("\n");

  const analysis = analyzeCsvContent(csv);
  assert.equal(analysis.delimiter, ";");
  assert.equal(analysis.mapping.operationDate, "Date operation");
  assert.equal(analysis.mapping.label, "Libelle");
  assert.equal(analysis.mapping.debit, "Debit");
});

test("parseCsvContent normalizes debit and credit into common contract", () => {
  const csv = [
    "Date operation;Date valeur;Libelle;Debit;Credit;Reference",
    "05/01/2026;06/01/2026;CB CARREFOUR VITROLLES;82,43;;ABC123",
    "07/01/2026;07/01/2026;VIREMENT SALAIRE;;1200,00;SAL001",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "releve.csv",
    accountId: "acc-1",
  });

  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].operationDate, "2026-01-05");
  assert.equal(result.transactions[0].amount, -82.43);
  assert.equal(result.transactions[0].type, "depense");
  assert.equal(result.transactions[0].normalizedLabel, "CB CARREFOUR VITROLLES");
  assert.equal(result.transactions[1].amount, 1200);
  assert.equal(result.transactions[1].type, "revenu");
});

test("parseCsvContent supports signed amount column with english delimiter", () => {
  const csv = [
    "Booking Date,Description,Amount",
    "2026-01-05,AMAZON,-12.90",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "statement.csv",
    accountId: "acc-1",
  });

  assert.equal(result.requiresMapping, false);
  assert.equal(result.transactions[0].amount, -12.9);
});

test("parseCsvContent does not mutate source content and marks missing amount as review_required", () => {
  const csv = [
    "Date,Libelle,Reference",
    "05/01/2026,CB TEST,REF1",
  ].join("\n");
  const original = csv;

  const result = parseCsvContent(csv, {
    sourceFileName: "releve.csv",
    accountId: "acc-1",
  });

  assert.equal(csv, original);
  assert.equal(result.transactions[0].importStatus, "review_required");
  assert.equal(result.transactions[0].warnings.includes("montant_invalide"), true);
});

test("parseCsvContent handles fixture with french amount and blank lines", async () => {
  const csv = await readFile(resolve(fixturesDir, "credit-agricole-semi.csv"), "utf8");

  const result = parseCsvContent(csv, {
    sourceFileName: "credit-agricole-semi.csv",
    accountId: "acc-1",
  });

  assert.equal(result.transactions.length, 3);
  assert.equal(result.transactions[1].amount, 1200);
  assert.equal(result.transactions[1].type, "revenu");
  assert.equal(result.transactions[2].importStatus, "review_required");
});

test("parseCsvContent detects header after metadata and preserves multiline labels", () => {
  const csv = [
    "Telechargement du 11/07/2026;",
    "",
    "Liste des operations du compte entre le 01/01/2026 et le 11/07/2026;",
    "",
    "Date;Libelle;Debit euros;Credit euros;",
    "11/07/2026;\"Prelevement",
    "FRAIS CARTE A L ETRANGER\";1,20;;",
    "10/07/2026;\"Virement en votre faveur",
    "FRANCE TRAVAIL\";;1200,00;",
  ].join("\n");

  const analysis = analyzeCsvContent(csv);
  assert.equal(analysis.delimiter, ";");
  assert.equal(analysis.mapping.operationDate, "Date");
  assert.equal(analysis.mapping.label, "Libelle");
  assert.equal(analysis.mapping.debit, "Debit euros");
  assert.equal(analysis.mapping.credit, "Credit euros");

  const result = parseCsvContent(csv, {
    sourceFileName: "credit-agricole-real-shape.csv",
    accountId: "acc-1",
  });

  assert.equal(result.requiresMapping, false);
  assert.equal(result.transactions.length, 2);
  assert.equal(result.transactions[0].rawLabel.includes("FRAIS CARTE A L ETRANGER"), true);
  assert.equal(result.transactions[0].amount, -1.2);
  assert.equal(result.transactions[0].type, "depense");
  assert.equal(result.transactions[1].amount, 1200);
  assert.equal(result.transactions[1].type, "revenu");
});

test("analyzeCsvContent flags manual mapping when date header is unknown", async () => {
  const csv = await readFile(resolve(fixturesDir, "manual-mapping.csv"), "utf8");
  const analysis = analyzeCsvContent(csv);

  assert.equal(analysis.requiresMapping, true);
});

test("parseCsvContent supports signed amount comma fixture", async () => {
  const csv = await readFile(resolve(fixturesDir, "signed-comma.csv"), "utf8");
  const result = parseCsvContent(csv, {
    sourceFileName: "signed-comma.csv",
    accountId: "acc-1",
  });

  assert.equal(result.transactions[0].amount, -12.9);
  assert.equal(result.transactions[1].amount, 1200);
});

test("parseCsvContent returns empty preview for empty file", () => {
  const result = parseCsvContent("", {
    sourceFileName: "empty.csv",
    accountId: "acc-1",
  });

  assert.deepEqual(result.headers, []);
  assert.equal(result.transactions.length, 0);
  assert.equal(result.requiresMapping, true);
});

test("parseCsvContent marks corrupted rows for review", () => {
  const csv = [
    "Date operation;Libelle;Debit;Credit",
    "05/01/2026;CB TEST;12,00",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "corrupt.csv",
    accountId: "acc-1",
  });

  assert.equal(result.transactions[0].importStatus, "review_required");
  assert.equal(result.transactions[0].warnings.includes("ligne_corrompue"), true);
});

test("parseCsvContent requires mapping when date column is absent", () => {
  const csv = [
    "Libelle;Debit;Credit",
    "CB TEST;12,00;",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "missing-date.csv",
    accountId: "acc-1",
  });

  assert.equal(result.requiresMapping, true);
});

test("parseCsvContent review_requires when amount columns are absent", () => {
  const csv = [
    "Date operation;Libelle;Reference",
    "05/01/2026;CB TEST;REF1",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "missing-amount.csv",
    accountId: "acc-1",
  });

  assert.equal(result.requiresMapping, true);
  assert.equal(result.transactions[0].warnings.includes("montant_invalide"), true);
});

test("parseCsvContent rejects zero amount rows", () => {
  const csv = [
    "Date operation;Libelle;Amount",
    "05/01/2026;CB TEST;0",
  ].join("\n");

  const result = parseCsvContent(csv, {
    sourceFileName: "zero.csv",
    accountId: "acc-1",
  });

  assert.equal(result.transactions[0].warnings.includes("montant_invalide"), true);
});

test("parseCsvContent keeps categoryId null and source string immutable while internal duplicates can be derived later", () => {
  const csv = [
    "Date operation;Libelle;Debit;Credit;Reference",
    "05/01/2026;CB TEST;12,00;;REF1",
    "05/01/2026;CB TEST;12,00;;REF1",
  ].join("\n");
  const original = csv;

  const result = parseCsvContent(csv, {
    sourceFileName: "duplicate.csv",
    accountId: "acc-1",
  });

  assert.equal(csv, original);
  assert.equal(result.transactions[0].categoryId, null);
  assert.equal(result.transactions[1].categoryId, null);
});