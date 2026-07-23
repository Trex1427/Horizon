import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const transactionCardPath = resolve(process.cwd(), "src/components/TransactionCard.jsx");

test("TransactionCard delegates category label resolution to shared helper", async () => {
  const content = await readFile(transactionCardPath, "utf8");

  assert.equal(content.includes("getTransactionDisplayCategoryLabel(transaction, categoryMeta)"), true);
  assert.equal(content.includes("../utils/transactionCategoryDisplay"), true);
  assert.equal(content.includes("enableDoubleClickEdit = false"), true);
  assert.equal(content.includes("enableDoubleClickEdit={enableDoubleClickEdit}"), true);
});

test("TransactionCard maps visible transaction zones to editor focus targets", async () => {
  const content = await readFile(transactionCardPath, "utf8");

  assert.equal(content.includes("TRANSACTION_EDITOR_FOCUS_TARGETS"), true);
  assert.equal(content.includes("titleField={TRANSACTION_EDITOR_FOCUS_TARGETS.description}"), true);
  assert.equal(content.includes("categoryIconField={TRANSACTION_EDITOR_FOCUS_TARGETS.category}"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.type"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.amount"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.account"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.date"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.category"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.subcategory"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.activity"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.thirdParty"), true);
  assert.equal(content.includes("field: TRANSACTION_EDITOR_FOCUS_TARGETS.project"), true);
  assert.equal(content.includes("onFieldDoubleClick={onFieldDoubleClick}"), true);
});
