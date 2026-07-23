import test from "node:test";
import assert from "node:assert/strict";
import {
  TRANSACTION_EDITOR_FOCUS_SELECTORS,
  TRANSACTION_EDITOR_FOCUS_TARGETS,
  getTransactionEditorFocusSelector,
} from "./transactionEditorFocusTargets.js";

test("transaction editor focus targets map zones to form field selectors", () => {
  assert.deepEqual(Object.keys(TRANSACTION_EDITOR_FOCUS_TARGETS).sort(), [
    "account",
    "activity",
    "amount",
    "category",
    "date",
    "description",
    "project",
    "subcategory",
    "thirdParty",
    "type",
  ]);

  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.description, 'input[name="description"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.date, 'input[name="date"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.amount, 'input[name="montant"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.type, 'input[name="type"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.account, 'input[name="accountId"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.category, 'input[name="categorie"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.subcategory, 'input[name="subcategoryId"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.thirdParty, 'input[name="thirdPartyId"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.activity, 'input[name="activityId"]');
  assert.equal(TRANSACTION_EDITOR_FOCUS_SELECTORS.project, 'input[name="projectId"]');
  assert.equal(getTransactionEditorFocusSelector("unknown"), "");
});
