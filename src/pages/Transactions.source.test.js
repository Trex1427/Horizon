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
  assert.equal(content.includes('openQuickFixedExpenseDialog(resolveVisibleSelectedTransactions(selectedTransactionIds, displayedTransactions))'), true);
  assert.equal(content.includes('onRequestCreateFixedExpense={requestQuickFixedExpenseCreation}'), true);
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
    assert.equal(content.includes('openQuickFixedExpenseDialog([], oldForm);'), true);
  assert.equal(content.includes('quickCategoryOpen'), true);
  assert.equal(content.includes('quickAccountOpen'), true);
  assert.equal(content.includes('quickActivityOpen'), true);
  assert.equal(content.includes('quickProjectOpen'), true);
  assert.equal(content.includes('quickFixedExpenseOpen'), true);
    assert.equal(content.includes('quickFixedExpenseSourceForm'), true);
    assert.equal(content.includes('quickFixedExpenseSourceTransactionIds'), true);
  assert.equal(content.includes('isFixedExpense: true'), true);
  assert.equal(content.includes('fixedExpenseId: result.id || previous.fixedExpenseId'), true);
});

test("Transactions uses compact toolbar with smart sticky behavior and selection summary", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('<AppStickyPanel'), true);
  assert.equal(content.includes('className="transactions-smart-sticky-header"'), true);
  assert.equal(content.includes('compactToolbarButtonMinHeight = 44'), true);
  assert.equal(content.includes('compactToolbarActionPaddingX = "12px"') || content.includes('compactToolbarActionPaddingX = spacing.sm'), true);
  assert.equal(content.includes('smartHeaderCollapseProgress'), true);
  assert.equal(content.includes('maxHeight: `${smartHeaderKpiMaxHeight}px`'), true);
  assert.equal(content.includes('Math.round(136 * (1 - smartHeaderCollapseProgress))'), true);
  assert.equal(content.includes('ariaLabel="En-t'), true);
  assert.equal(content.includes('ariaHidden={smartHeaderKpiMaxHeight <= 10}'), true);
  assert.equal(content.includes('label="Toolbar transactions reconstruite"'), true);
  assert.equal(content.includes('transactions-toolbar-core'), true);
  assert.equal(content.includes('<AppToolbarSearchField'), true);
  assert.equal(content.includes('className="v2-card transactions-compact-toolbar"'), false);
  assert.equal(content.includes('className="v2-card transactions-compact-toolbar transactions-toolbar-core"'), true);
  assert.equal(content.includes('className="v2-card transactions-compact-toolbar-actions"'), true);
  assert.equal(content.includes('placeholder="Rechercher une transaction..."'), true);
  assert.equal(content.includes('ariaLabel="Rechercher une transaction"'), true);
  assert.equal(content.includes('onOpenSecondaryTools={openSecondaryActionsMenu}'), true);
  assert.equal(content.includes('hiddenLabel'), false);
  assert.equal(content.includes('InputAdornment'), false);
  assert.equal(content.includes('<Search fontSize="small" />'), false);
  assert.equal(content.includes('<Settings fontSize="small" />'), false);
  assert.equal(content.includes('selectedTransactionsSummary'), true);
  assert.equal(content.includes('displayedTransactionsCount = displayedTransactions.length'), true);
  assert.equal(content.includes('isSelectionEmpty = selectedTransactionsCount === 0'), true);
  assert.equal(content.includes('isSelectionComplete = displayedTransactionsCount > 0 && selectedTransactionsCount === displayedTransactionsCount'), true);
  assert.equal(content.includes('isSelectionPartial = !isSelectionEmpty && !isSelectionComplete'), true);
  assert.equal(content.includes('aria-label="Résumé de la sélection"'), true);
  assert.equal(content.includes('Dépenses: {formatSummaryAmount(selectedTransactionsSummary.expenses)}'), true);
  assert.equal(content.includes('Revenus: {formatSummaryAmount(selectedTransactionsSummary.revenues)}'), true);
  assert.equal(content.includes('Net: {formatSummaryAmount(selectedTransactionsSummary.net)}'), true);
  assert.equal(content.includes('aria-label="Actions de sélection rapides"'), true);
  assert.equal(content.includes('(isSelectionEmpty || isSelectionPartial)'), true);
  assert.equal(content.includes('(isSelectionPartial || isSelectionComplete)'), true);
  assert.equal(content.includes('onClick={selectDisplayedTransactions}'), true);
  assert.equal(content.includes('onClick={deselectAllTransactions}'), true);
  assert.equal(content.includes('Tout sélectionner'), true);
  assert.equal(content.includes('Tout désélectionner'), true);
  assert.equal(content.includes('disabled={bulkOperationLoading || displayedTransactionsCount === 0}'), true);
  assert.equal(content.includes('aria-label="Tout sélectionner les transactions affichées"'), true);
  assert.equal(content.includes('aria-label="Tout désélectionner les transactions affichées"'), true);
  assert.equal(content.includes('direction={{ xs: "column", sm: "row" }}'), true);
  assert.equal(content.includes('label="Actions principales des transactions"'), true);
  assert.equal(content.includes('aria-label="Actions principales des transactions"'), true);
  assert.equal(content.includes('label="Outils de filtrage des transactions"'), false);
  assert.equal(content.includes('aria-label="Filtres Tri Période"'), true);
  assert.equal(content.includes('openPeriodMenu'), true);
  assert.equal(content.includes('handleQuickPeriodChange'), true);
  assert.equal(content.includes('Période: ${currentPeriodLabel}'), true);
  assert.equal(content.includes('Ajouter une transaction'), true);
  assert.equal(content.includes('Sélection'), true);
  assert.equal(content.includes('Sélectionner'), false);
  assert.equal(content.includes('Annuler'), true);
  assert.equal(content.includes('Modifier'), true);
  assert.equal(content.includes('Classer'), true);
  assert.equal(content.includes('Créer un frais fixe'), true);
  assert.equal(content.includes('Supprimer'), true);
  assert.equal(content.includes('MoreVert'), false);
  assert.equal(content.includes('label="Recherche rapide"'), false);
  assert.equal(content.includes('"& input": {'), false);
  assert.equal(content.includes('spacing={0.6}'), true);
  assert.equal(content.includes('flexWrap: "wrap"'), true);
  assert.equal(content.includes('direction="row" spacing={0.6} sx={{ width: "100%" }} aria-label="Filtres Tri Période"'), true);
  assert.equal(content.includes('Outils secondaires'), false);
  assert.equal(content.includes('aria-label={`Choisir la période (${currentPeriodLabel})`}'), true);
  assert.equal(content.includes('aria-label="Choix de période"'), false);
  assert.equal(content.includes('openFiltersDialog'), true);
  assert.equal(content.includes('openSortDialog'), true);
  assert.equal(content.includes('openSecondaryActionsMenu'), true);
  assert.equal(content.includes('openSelectionMode'), true);
  assert.equal(content.includes('openCreateTransactionDialog'), true);
});

test("Transactions selection mode keeps select-all/deselect-all behavior for empty partial and full selection", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('const isSelectionEmpty = selectedTransactionsCount === 0;'), true);
  assert.equal(content.includes('const isSelectionComplete = displayedTransactionsCount > 0 && selectedTransactionsCount === displayedTransactionsCount;'), true);
  assert.equal(content.includes('const isSelectionPartial = !isSelectionEmpty && !isSelectionComplete;'), true);
  assert.equal(content.includes('{(isSelectionEmpty || isSelectionPartial) && ('), true);
  assert.equal(content.includes('{(isSelectionPartial || isSelectionComplete) && ('), true);
  assert.equal(content.includes('onClick={selectDisplayedTransactions}'), true);
  assert.equal(content.includes('onClick={deselectAllTransactions}'), true);
  assert.equal(content.includes('Modifier'), true);
  assert.equal(content.includes('Classer'), true);
  assert.equal(content.includes('Créer un frais fixe'), true);
  assert.equal(content.includes('Supprimer'), true);
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

test("Transactions bulk classification quick-create reuses import flow without closing classification dialog", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('function openQuickCategoryFromBulk(payload = {})'), true);
  assert.equal(content.includes('function openQuickSubcategoryFromBulk(payload = {})'), true);
  assert.equal(content.includes('function openQuickThirdPartyFromBulk(payload = {})'), true);
  assert.equal(content.includes('function openQuickActivityFromBulk(payload = {})'), true);
  assert.equal(content.includes('function openQuickProjectFromBulk(payload = {})'), true);
  assert.equal(content.includes('openImportQuickCreate("category", normalizedPayload || {});'), true);
  assert.equal(content.includes('openImportQuickCreate("subcategory", payload || {});'), true);
  assert.equal(content.includes('openImportQuickCreate("thirdParty", payload || {});'), true);
  assert.equal(content.includes('openImportQuickCreate("activity", payload || {});'), true);
  assert.equal(content.includes('openImportQuickCreate("project", payload || {});'), true);
  assert.equal(content.includes('setBulkEditDialogOpen(false);\n    openQuickCategoryDialog'), false);
  assert.equal(content.includes('setBulkEditDialogOpen(false);\n    openQuickSubcategoryDialog'), false);
  assert.equal(content.includes('setBulkEditDialogOpen(false);\n    openQuickThirdPartyDialog'), false);
  assert.equal(content.includes('setBulkEditDialogOpen(false);\n    openQuickActivityDialog'), false);
  assert.equal(content.includes('setBulkEditDialogOpen(false);\n    openQuickProjectDialog'), false);
});

test("Transactions quick fixed-expense dialog supports full classification and optional propagation", async () => {
  const content = await readFile(transactionsPath, "utf8");

  assert.equal(content.includes('label="Catégorie"'), true);
  assert.equal(content.includes('label="Sous-catégorie"'), true);
  assert.equal(content.includes('label="Tiers"'), true);
  assert.equal(content.includes('label="Activité"'), true);
  assert.equal(content.includes('label="Projet"'), true);
  assert.equal(content.includes('requestQuickFixedExpenseReferenceCreate("category"'), true);
  assert.equal(content.includes('requestQuickFixedExpenseReferenceCreate("subcategory"'), true);
  assert.equal(content.includes('requestQuickFixedExpenseReferenceCreate("thirdParty"'), true);
  assert.equal(content.includes('requestQuickFixedExpenseReferenceCreate("activity"'), true);
  assert.equal(content.includes('requestQuickFixedExpenseReferenceCreate("project"'), true);
  assert.equal(content.includes('setQuickFixedExpenseAutoFocusSelector'), true);
  assert.equal(content.includes('quickFixedExpenseApplyClassificationToSource'), true);
  assert.equal(content.includes('Appliquer immédiatement ce classement aux transactions sélectionnées'), true);
  assert.equal(content.includes('buildQuickFixedExpenseClassificationPatch(quickFixedExpenseSourceForm)'), true);
  assert.equal(content.includes('bulkUpdateTransactions({'), true);
  assert.equal(content.includes('clearIncompatibleSubcategories: true'), true);
  assert.equal(content.includes('setQuickFixedExpenseApplyClassificationToSource(sourceTransactionIds.length > 0);'), true);
  assert.equal(content.includes('await associateTransactionsWithFixedExpense({'), true);
  assert.equal(content.includes('const payload = buildQuickFixedExpensePayload(quickFixedExpenseSourceForm, quickFixedExpenseForm);'), true);
  assert.equal(content.includes('const result = await addFixedExpense(payload);'), true);
});
