import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { analyzeBankFile, buildBankImportPreview, buildBankImportValidationRows } from "../services/bankingImportService.js";

const fixturesDir = resolve(process.cwd(), "src/features/bankingImport/tests/fixtures");

function createLocalFile({ name, type, content }) {
  return {
    name,
    type,
    async arrayBuffer() {
      return new TextEncoder().encode(content).buffer;
    },
  };
}

test("analyzeBankFile and preview support Revolut PDF without automatic Firestore commit", async () => {
  const content = await readFile(resolve(fixturesDir, "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf"), "utf8");
  let commitCalled = false;
  const file = createLocalFile({
    name: "account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf",
    type: "application/pdf",
    content,
  });

  const analysis = await analyzeBankFile(file);
  const preview = buildBankImportPreview({
    format: analysis.formatInfo.format,
    content: analysis.content,
    fileName: file.name,
    accountId: "acc-revolut",
  });
  const rows = buildBankImportValidationRows({
    preview,
    existingTransactions: [
      {
        id: "existing-card",
        accountId: "acc-revolut",
        type: "depense",
        montant: 45.2,
        date: "2026-07-15",
        description: "Paiement carte Supermarche A Market Test",
      },
    ],
    categories: [],
  });

  assert.equal(analysis.formatInfo.displayLabel, "PDF Revolut");
  assert.equal(analysis.formatInfo.supported, true);
  assert.equal(preview.transactions.length, 4);
  assert.equal(preview.statementPeriod.startDate, "2026-06-01");
  assert.equal(rows.some((row) => row.duplicateStatus === "probable_duplicate"), true);
  assert.equal(commitCalled, false);
});
