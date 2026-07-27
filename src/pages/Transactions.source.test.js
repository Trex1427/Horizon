import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const transactionsPath = resolve(process.cwd(), "src/pages/Transactions.jsx");
const transactionsServicePath = resolve(process.cwd(), "src/services/transactionsService.js");

test("Transactions bulk selection and update wiring stays scoped to selected displayed items", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes("setSelectedTransactionIds(displayedTransactions.map((transaction) => transaction.id));"), true);
  assert.equal(content.includes("transactionIds: visibleSelectedTransactionIds"), true);
  assert.equal(content.includes("bulkDeleteTransactions({ transactionIds: visibleSelectedTransactionIds })"), true);
  assert.equal(content.includes("resolveVisibleSelectedTransactionIds(selectedTransactionIds, displayedTransactions)"), true);
  assert.equal(content.includes("setSelectedTransactionIds(result.failedIds);"), true);
  assert.equal(content.includes("openBulkEditDialog(\"advanced\")"), true);
});

test("Transactions source remains isolated by ownerUid", async () => {
  const content = await readFile(transactionsServicePath, "utf8");
  assert.equal(content.includes('where("ownerUid", "==", ownerUid)'), true);
  assert.equal(content.includes("sanitizeUserPayload"), true);
});

test("Transactions opens existing quick-create dialogs from dropdown sentinels without storing sentinel values", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('value === CREATE_CATEGORY_VALUE'), true);
  assert.equal(content.includes('value === CREATE_THIRD_PARTY_VALUE'), true);
  assert.equal(content.includes('value === CREATE_SUBCATEGORY_VALUE'), true);
  assert.equal(content.includes('value === CREATE_ACCOUNT_VALUE'), true);
  assert.equal(content.includes('value === CREATE_ACTIVITY_VALUE'), true);
  assert.equal(content.includes('value === CREATE_PROJECT_VALUE'), true);
  assert.equal(content.includes('value === CREATE_FIXED_EXPENSE_VALUE'), true);
  assert.equal(content.includes('openQuickCategoryDialog();'), true);
  assert.equal(content.includes('openQuickThirdPartyDialog();'), true);
  assert.equal(content.includes('openQuickSubcategoryDialog();'), true);
  assert.equal(content.includes('openQuickAccountDialog();'), true);
  assert.equal(content.includes('openQuickActivityDialog();'), true);
  assert.equal(content.includes('openQuickProjectDialog();'), true);
  assert.equal(content.includes('openQuickFixedExpenseDialog();'), true);
  assert.equal(content.includes('quickCategoryOpen'), true);
  assert.equal(content.includes('quickAccountOpen'), true);
  assert.equal(content.includes('quickActivityOpen'), true);
  assert.equal(content.includes('quickProjectOpen'), true);
  assert.equal(content.includes('quickFixedExpenseOpen'), true);
  assert.equal(content.includes('isFixedExpense: true'), true);
  assert.equal(content.includes('fixedExpenseId: result.id || previous.fixedExpenseId'), true);
});

test("Transactions keeps command bar sticky with search, filters, sort, and selection actions", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('position: "sticky"'), true);
  assert.equal(content.includes('label="Recherche rapide"'), true);
  assert.equal(content.includes('openFiltersDialog'), true);
  assert.equal(content.includes('openSortDialog'), true);
  assert.equal(content.includes('openSelectionMode'), true);
  assert.equal(content.includes('openCreateTransactionDialog'), true);
});

test("Transactions guards quick account creation against double submission", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes("quickAccountSubmittingRef"), true);
  assert.equal(content.includes("if (quickAccountSubmittingRef.current)"), true);
  assert.equal(content.includes("quickAccountSubmittingRef.current = true"), true);
  assert.equal(content.includes("submitting={quickAccountSubmitting}"), true);
});

test("Transactions reuses existing quick-create dialogs from bank import rows", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes("importQuickCreateRef"), true);
  assert.equal(content.includes("function openImportQuickCreate"), true);
  assert.equal(content.includes("function consumeImportQuickCreate"), true);
  assert.equal(content.includes('openImportQuickCreate("category", payload)'), true);
  assert.equal(content.includes('openImportQuickCreate("subcategory", payload)'), true);
  assert.equal(content.includes('openImportQuickCreate("activity", payload)'), true);
  assert.equal(content.includes('openImportQuickCreate("thirdParty", payload)'), true);
  assert.equal(content.includes('openImportQuickCreate("project", payload)'), true);
  assert.equal(content.includes('openImportQuickCreate("account", payload)'), true);
  assert.equal(content.includes('consumeImportQuickCreate("category"'), true);
  assert.equal(content.includes('consumeImportQuickCreate("subcategory"'), true);
  assert.equal(content.includes('consumeImportQuickCreate("thirdParty"'), true);
  assert.equal(content.includes('consumeImportQuickCreate("activity"'), true);
  assert.equal(content.includes('consumeImportQuickCreate("project"'), true);
  assert.equal(content.includes('consumeImportQuickCreate("account"'), true);
  assert.equal(content.includes("importQuickCreateRef.current = null;"), true);
  assert.equal(content.includes("errorMessage={transactionEditorError}"), true);
});

test("Transactions propagates and resets transaction editor focus target", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes("transactionEditorFocusTarget"), true);
  assert.equal(content.includes("resolveTransactionEditorFocusTarget(uiContext.focusTarget)"), true);
  assert.equal(content.includes("function handleEdit(transaction, uiContext = {})"), true);
  assert.equal(content.includes("onFieldDoubleClick={(focusTarget) => handleEdit(transaction, { focusTarget })}"), true);
  assert.equal(content.includes("onEditClick={() => handleEdit(transaction)}"), true);
  assert.equal(content.includes("initialFocusTarget={transactionEditorFocusTarget}"), true);
  assert.equal((content.match(/setTransactionEditorFocusTarget\(""\)/g) || []).length >= 3, true);
  assert.equal(content.includes("if (transactionEditorOpen)"), true);
});

test("Transactions wires manual intelligent classification suggestions without auto-saving", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes("buildTransactionClassificationSuggestion"), true);
  assert.equal(content.includes("manualClassificationSuggestion"), true);
  assert.equal(content.includes("classificationSuggestion={manualClassificationSuggestionKey === ignoredClassificationSuggestionKey ? null : manualClassificationSuggestion}"), true);
  assert.equal(content.includes("onIgnoreClassificationSuggestion={ignoreManualClassificationSuggestion}"), true);
  assert.equal(content.includes("setIgnoredClassificationSuggestionKey(manualClassificationSuggestionKey)"), true);
});
