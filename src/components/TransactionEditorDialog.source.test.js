import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const dialogPath = resolve(process.cwd(), "src/components/TransactionEditorDialog.jsx");

test("TransactionEditorDialog derives autofocus selector from optional focus target", async () => {
  const content = await readFile(dialogPath, "utf8");

  assert.equal(content.includes("getTransactionEditorFocusSelector"), true);
  assert.equal(content.includes('initialFocusTarget = ""'), true);
  assert.equal(content.includes("const autoFocusSelector = getTransactionEditorFocusSelector(initialFocusTarget);"), true);
  assert.equal(content.includes("autoFocusSelector={autoFocusSelector}"), true);
  assert.equal(content.includes('autoFocusSelector=\'input[name="date"]\''), false);
});

test("TransactionEditorDialog exposes classification suggestion and ignore action", async () => {
  const content = await readFile(dialogPath, "utf8");

  assert.equal(content.includes("classificationSuggestion = null"), true);
  assert.equal(content.includes("onIgnoreClassificationSuggestion = null"), true);
  assert.equal(content.includes("classificationSuggestion.label"), true);
  assert.equal(content.includes("classificationSuggestion.score"), true);
  assert.equal(content.includes("Ignorer"), true);
});
