import test from "node:test";
import assert from "node:assert/strict";
import { detectFileFormat } from "../detectors/detectFileFormat.js";

test("detectFileFormat recognizes csv by extension", () => {
  const result = detectFileFormat({ fileName: "releve.csv", mimeType: "text/csv" });
  assert.equal(result.format, "csv");
  assert.equal(result.supported, true);
});

test("detectFileFormat recognizes Revolut PDF before QIF heuristics", () => {
  const revolutPdfText = [
    "%PDF-1.7",
    "Releve EUR",
    "Revolut France",
    "Resume du solde",
    "Transactions du compte",
    "Argent sortant",
    "Argent entrant",
    "Date",
    "Type",
    "D 2026-07-01",
    "T 12,34",
  ].join("\n");

  const result = detectFileFormat({
    fileName: "revolut-statement.pdf",
    mimeType: "application/pdf",
    content: revolutPdfText,
  });

  assert.equal(result.format, "pdf");
  assert.equal(result.supported, true);
  assert.equal(result.detectionSource, "revolut-pdf");
  assert.equal(result.displayLabel, "PDF Revolut");
  assert.equal(result.sourceBank, "revolut");
});

test("detectFileFormat recognizes application/pdf MIME and PDF binary signature", () => {
  const byMime = detectFileFormat({
    fileName: "statement",
    mimeType: "application/pdf",
    content: "Revolut France\nReleve EUR\nTransactions du compte",
  });
  const byBinarySignature = detectFileFormat({
    fileName: "statement.bin",
    mimeType: "application/octet-stream",
    content: "%PDF-1.7\n1 0 obj",
  });

  assert.equal(byMime.format, "pdf");
  assert.equal(byMime.supported, true);
  assert.equal(byMime.detectionSource, "revolut-pdf");
  assert.equal(byBinarySignature.format, "pdf");
  assert.equal(byBinarySignature.supported, false);
  assert.equal(byBinarySignature.detectionSource, "pdf");
});

test("detectFileFormat recognizes Revolut CSV", () => {
  const csv = [
    "Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance",
    "CARD_PAYMENT,Current,2026-07-01,2026-07-01,TEST,-12.34,0,EUR,COMPLETED,100.00",
  ].join("\n");

  const result = detectFileFormat({
    fileName: "revolut.csv",
    mimeType: "text/csv",
    content: csv,
  });

  assert.equal(result.format, "csv");
  assert.equal(result.supported, true);
  assert.equal(result.detectionSource, "extension");
});

test("detectFileFormat recognizes ofx by content signature", () => {
  const result = detectFileFormat({ fileName: "statement.txt", content: "OFXHEADER:100\n<OFX>" });
  assert.equal(result.format, "ofx");
  assert.equal(result.supported, false);
});

test("detectFileFormat recognizes qif only from a QIF header", () => {
  const result = detectFileFormat({
    fileName: "statement.txt",
    content: "!Type:Bank\nD01/07/2026\nT-12.34\nPCARD PAYMENT\n^",
  });

  assert.equal(result.format, "qif");
  assert.equal(result.supported, false);
  assert.equal(result.detectionSource, "content");
});

test("detectFileFormat rejects weak QIF-like fragments", () => {
  const result = detectFileFormat({
    fileName: "statement.txt",
    content: "!Type:Bank\nD01/07/2026\nT-12.34\nPCARD PAYMENT",
  });

  assert.equal(result.format, "unknown");
  assert.equal(result.supported, false);
});

test("detectFileFormat returns unsupported pdf for unknown PDF", () => {
  const result = detectFileFormat({
    fileName: "unknown.pdf",
    mimeType: "application/pdf",
    content: "%PDF-1.7\nBanque inconnue",
  });

  assert.equal(result.format, "pdf");
  assert.equal(result.supported, false);
  assert.equal(result.displayLabel, "PDF");
});

test("detectFileFormat returns unknown for unrecognized content", () => {
  const result = detectFileFormat({
    fileName: "statement.txt",
    content: "Date\nType\nD ligne quelconque\nT ligne quelconque",
  });

  assert.equal(result.format, "unknown");
  assert.equal(result.supported, false);
});
