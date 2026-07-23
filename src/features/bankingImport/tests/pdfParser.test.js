import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { extractPdfTextFromBytes, parsePdfContent } from "../parsers/pdfParser.js";

const fixturesDir = resolve(process.cwd(), "src/features/bankingImport/tests/fixtures");

function octalByte(value) {
  return value.toString(8).padStart(3, "0");
}

function encodeCMapLiteral(value = "") {
  return Array.from(value).map((char) => `\\000\\${octalByte(char.charCodeAt(0))}`).join("");
}

function buildCompressedPdfTextFixture(lines = []) {
  const cmap = [
    "beginbfrange",
    "<0020><007E><0020>",
    "endbfrange",
  ].join("\n");
  const textStream = lines.map((line) => `(${encodeCMapLiteral(line)}) Tj`).join("\n");
  const compressedCMap = deflateSync(Buffer.from(cmap, "binary")).toString("binary");
  const compressedText = deflateSync(Buffer.from(textStream, "binary")).toString("binary");

  return Buffer.from([
    "%PDF-1.7",
    "1 0 obj",
    "<< /Filter /FlateDecode >>",
    "stream",
    compressedCMap,
    "endstream",
    "endobj",
    "2 0 obj",
    "<< /Filter /FlateDecode >>",
    "stream",
    compressedText,
    "endstream",
    "endobj",
    "%%EOF",
  ].join("\n"), "binary");
}

test("extractPdfTextFromBytes reads compressed PDF text with ToUnicode mapping", async () => {
  const pdf = buildCompressedPdfTextFixture([
    "Releve EUR",
    "Revolut France",
    "Resume du solde",
    "Transactions du compte",
  ]);

  const text = await extractPdfTextFromBytes(new Uint8Array(pdf));

  assert.match(text, /Releve EUR/);
  assert.match(text, /Revolut France/);
  assert.match(text, /Resume du solde/);
  assert.match(text, /Transactions du compte/);
});

test("parsePdfContent extracts Revolut PDF statement transactions without importing summary rows", async () => {
  const pdf = await readFile(resolve(fixturesDir, "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf"), "latin1");
  const result = parsePdfContent(pdf, {
    sourceFileName: "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf",
    accountId: "acc-revolut",
  });

  assert.equal(result.format, "pdf");
  assert.equal(result.sourceBank, "revolut");
  assert.equal(result.requiresMapping, false);
  assert.equal(result.statementPeriod.startDate, "2026-06-01");
  assert.equal(result.statementPeriod.endDate, "2026-07-15");
  assert.equal(result.statementSummary.openingBalance, 978.1);
  assert.equal(result.statementSummary.totalOutgoing, 2065.72);
  assert.equal(result.statementSummary.totalIncoming, 2626.61);
  assert.equal(result.statementSummary.closingBalance, 1538.99);
  assert.equal(result.transactions.length, 4);
  assert.equal(result.transactions.some((row) => row.rawLabel.includes("Solde d'ouverture")), false);
});

test("parsePdfContent maps outgoing, incoming, refund and returned operations", async () => {
  const pdf = await readFile(resolve(fixturesDir, "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf"), "latin1");
  const result = parsePdfContent(pdf, {
    sourceFileName: "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf",
    accountId: "acc-revolut",
  });

  const outgoing = result.transactions.find((row) => row.bankReference === "CARD-001");
  const incoming = result.transactions.find((row) => row.bankReference === "PAY-001");
  const refund = result.transactions.find((row) => row.bankReference === "REFUND-001");
  const returned = result.transactions.find((row) => row.bankReference === "RET-001");

  assert.equal(outgoing.operationDate, "2026-07-15");
  assert.equal(outgoing.amount, -45.2);
  assert.equal(outgoing.type, "depense");
  assert.equal(outgoing.rawLabel.includes("A : Market Test"), true);
  assert.equal(outgoing.amount === -1538.99, false);

  assert.equal(incoming.amount, 2500);
  assert.equal(incoming.type, "revenu");
  assert.equal(incoming.rawLabel.includes("De : Employeur Test"), true);

  assert.equal(refund.amount, 26.61);
  assert.equal(refund.type, "revenu");
  assert.equal(refund.warnings.includes("remboursement_a_verifier"), true);

  assert.equal(returned.amount, -100);
  assert.equal(returned.type, "depense");
  assert.equal(returned.importStatus, "review_required");
  assert.equal(returned.warnings.includes("operation_renvoyee_a_verifier"), true);
});
