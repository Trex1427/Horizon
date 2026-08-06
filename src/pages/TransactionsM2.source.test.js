import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("Transactions M2 exposes compact mobile controls and deferred full-screen filters", async () => {
  const source = await read("src/pages/Transactions.jsx");
  assert.match(source, /isMobileTransactionsView/);
  assert.match(source, /Ajouter une transaction/);
  assert.match(source, /fullScreen=\{isMobileTransactionsView\}/);
  assert.match(source, /function applyFiltersDialog/);
  assert.match(source, /Filtres \(\$\{activeFiltersCount\}\)/);
  assert.match(source, /Sans catégorie/);
});

test("Transactions M2 keeps essential card semantics and touch-sized actions", async () => {
  const [card, compact] = await Promise.all([
    read("src/components/TransactionCard.jsx"),
    read("src/components/CompactFinanceCard.jsx"),
  ]);
  for (const token of ["amountDisplay.text", "transaction?.description", "category", "accountLabel", "date", "transactionKind"]) {
    assert.equal(card.includes(token), true);
  }
  assert.match(compact, /minWidth: 44, minHeight: 44/);
  assert.match(compact, /aria-label=/);
});

test("Transactions M2 uses ordered basic fields, expandable references, and mobile OCR review", async () => {
  const [fields, draft, editor] = await Promise.all([
    read("src/components/TransactionFormFields.jsx"),
    read("src/components/TransactionDraftReviewDialog.jsx"),
    read("src/components/TransactionEditorDialog.jsx"),
  ]);
  assert.match(fields, /component="details"/);
  assert.match(fields, /Plus de détails/);
  assert.match(fields, /form\.vehicleId/);
  assert.match(draft, /fullScreen=\{isMobile\}/);
  assert.match(draft, /CREATE_VEHICLE_VALUE/);
  assert.match(editor, /EntityDialog/);
});
